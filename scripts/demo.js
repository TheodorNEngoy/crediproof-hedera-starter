import "dotenv/config";
import crypto from "crypto";
import {
  AccountCreateTransaction,
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TokenId,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
  TransferTransaction,
  TokenBurnTransaction,
} from "@hashgraph/sdk";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} in .env — copy .env.example to .env and fill values`);
    process.exit(1);
  }
  return v;
}

// Accept both ED25519 (DER string, starts 302e...) and ECDSA (hex, starts 0x...)
function parsePrivateKey(s) {
  const key = s.trim();
  return key.startsWith("0x")
    ? PrivateKey.fromStringECDSA(key)
    : PrivateKey.fromString(key);
}

const operatorId = AccountId.fromString(requireEnv("HEDERA_ACCOUNT_ID"));
const operatorKey = parsePrivateKey(requireEnv("HEDERA_PRIVATE_KEY"));
const client = Client.forTestnet().setOperator(operatorId, operatorKey);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createTopicAndAnchor(invoice) {
  const tx = await new TopicCreateTransaction()
    .setTopicMemo("CrediProof invoice anchors")
    .execute(client);
  const receipt = await tx.getReceipt(client);
  const topicId = receipt.topicId;

  const payload = {
    type: "invoice_anchor",
    invoiceId: invoice.invoiceId,
    sha256: crypto.createHash("sha256").update(JSON.stringify(invoice)).digest("hex"),
    issuedAt: new Date().toISOString(),
  };

  await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify(payload))
    .execute(client);

  return { topicId, payload };
}

async function createInvoiceToken(symbol = "INV", decimals = 2) {
  const tx = await new TokenCreateTransaction()
    .setTokenName("Invoice Credit")
    .setTokenSymbol(symbol)
    .setTreasuryAccountId(operatorId)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setSupplyKey(operatorKey.publicKey)           // supply key required for mint/burn
    .setDecimals(decimals)
    .setInitialSupply(0)
    .freezeWith(client);

  const signed = await tx.sign(operatorKey);
  const submit = await signed.execute(client);
  const receipt = await submit.getReceipt(client);
  return receipt.tokenId;
}

async function createDemoRecipient() {
  const recipientKey = PrivateKey.generateED25519();
  const tx = await new AccountCreateTransaction()
    .setKey(recipientKey.publicKey)
    .setInitialBalance(new Hbar(5))
    .execute(client);
  const receipt = await tx.getReceipt(client);
  return { accountId: receipt.accountId, privateKey: recipientKey };
}

async function associateToken(accountId, accountKey, tokenId) {
  const associateTx = await new TokenAssociateTransaction()
    .setAccountId(accountId)
    .setTokenIds([tokenId])
    .freezeWith(client);
  const signed = await associateTx.sign(accountKey);
  const submit = await signed.execute(client);
  await submit.getReceipt(client);
}

async function mintAndTransfer(tokenId, recipientId, units) {
  const mintTx = await new TokenMintTransaction()
    .setTokenId(tokenId)
    .setAmount(units) // smallest units (respect decimals)
    .freezeWith(client);
  const mintSigned = await mintTx.sign(operatorKey);
  await (await mintSigned.execute(client)).getReceipt(client);

  const transferTx = await new TransferTransaction()
    .addTokenTransfer(tokenId, operatorId, -units)
    .addTokenTransfer(tokenId, recipientId, units)
    .freezeWith(client);
  const transferSigned = await transferTx.sign(operatorKey);
  await (await transferSigned.execute(client)).getReceipt(client);
}

async function settleAndBurn(tokenId, recipientId, recipientKey, units) {
  console.log("Simulating settlement: transfer back to treasury...");
  const settleTx = await new TransferTransaction()
    .addTokenTransfer(tokenId, recipientId, -units)
    .addTokenTransfer(tokenId, operatorId, units)
    .freezeWith(client);
  const settleSigned = await settleTx.sign(recipientKey);
  await (await settleSigned.execute(client)).getReceipt(client);

  console.log("Burning settled tokens (reduce total supply)...");
  const burnTx = await new TokenBurnTransaction()
    .setTokenId(tokenId)
    .setAmount(units)
    .freezeWith(client);
  const burnSigned = await burnTx.sign(operatorKey);
  await (await burnSigned.execute(client)).getReceipt(client);
}

(async () => {
  console.log("\n=== CrediProof: Hedera demo (Testnet) ===");
  console.log("Operator:", operatorId.toString());

  // Fake invoice JSON (replace with a form/real input later)
  const invoice = {
    invoiceId: "INV-" + Math.floor(Math.random() * 1e6),
    merchant: "Alice & Co.",
    payer: "Bob LLC",
    amount: 1250.75,
    currency: "USD",
    dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  };

  console.log("Creating topic & anchoring hashed invoice...");
  const { topicId, payload } = await createTopicAndAnchor(invoice);
  console.log("Topic ID:", topicId.toString());
  console.log("Anchored payload:", payload);

  await sleep(1500); // brief pause so the explorer indexes

  console.log("Creating HTS token (symbol INV)...");
  const tokenId = await createInvoiceToken("INV", 2);
  console.log("Token ID:", tokenId.toString());

  console.log("Creating demo recipient account...");
  const recipient = await createDemoRecipient();
  console.log("Recipient account:", recipient.accountId.toString());

  console.log("Associating token with recipient...");
  await associateToken(recipient.accountId, recipient.privateKey, tokenId);

  const units = Math.round(invoice.amount * 100); // 2 decimals
  console.log(`Minting ${units} units and transferring to recipient...`);
  await mintAndTransfer(tokenId, recipient.accountId, units);

  // Settlement + Burn (judges love full lifecycle)
  await settleAndBurn(tokenId, recipient.accountId, recipient.privateKey, units);

  console.log([
    "",
    "Verify on https://hashscan.io/testnet :",
    `• Topic:   ${topicId.toString()}  (see anchored message)`,
    `• Token:   ${tokenId.toString()}  (see supply, transfers, burn)`,
    `• Account: ${recipient.accountId.toString()}  (see token balance)`,
    "",
  ].join("\n"));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
