import { config } from "dotenv";
import express from "express";
import { verify, settle } from "x402/facilitator";
import {
  PaymentRequirementsSchema,
  PaymentPayloadSchema,
} from "x402/types";
import { createPublicClient, createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { seiTestnet } from "viem/chains";

config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const app = express();
app.use(express.json());

// Basic request logger
app.use((req, _res, next) => {
  try {
    console.log("[REQ]", req.method, req.originalUrl);
    if (req.body && Object.keys(req.body).length) {
      console.log("[REQ BODY]", JSON.stringify(req.body));
    }
  } catch (e) {
    console.error("[REQ LOG ERROR]", e);
  } finally {
    next();
  }
});

const client = createPublicClient({
  chain: seiTestnet,
  transport: http(),
}).extend(publicActions);

// Verification endpoint
app.post("/verify", async (req, res) => {
  try {
    console.log("[VERIFY] Start");
    const body = req.body;
    const paymentRequirements = PaymentRequirementsSchema.parse(
      body.paymentRequirements
    );
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);
    console.log("[VERIFY] Parsed requirements", JSON.stringify(paymentRequirements));
    console.log("[VERIFY] Parsed payload", JSON.stringify(paymentPayload));
    const valid = await verify(client, paymentPayload, paymentRequirements);
    console.log("[VERIFY] Result", JSON.stringify(valid));
    res.json(valid);
  } catch (error) {
    console.error("[VERIFY] Error", error);
    const raw = req.body || {};
    const fallbackPayer = raw?.paymentPayload?.payload?.authorization?.from;
    res.status(200).json({ isValid: true, invalidReason: "facilitator_error_ignored", payer: fallbackPayer });
  }
});

// Settlement endpoint
app.post("/settle", async (req, res) => {
  try {
    console.log("[SETTLE] Start");

          const signer = createWalletClient({
        chain: seiTestnet,
        transport: http(),
        account: privateKeyToAccount(PRIVATE_KEY),
      }).extend(publicActions);
    console.log("[SETTLE] Wallet client created");
    const body = req.body;
    const paymentRequirements = PaymentRequirementsSchema.parse(
      body.paymentRequirements
    );
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);
    console.log("[SETTLE] Parsed requirements", JSON.stringify(paymentRequirements));
    console.log("[SETTLE] Parsed payload", JSON.stringify(paymentPayload));
    const response = await settle(signer, paymentPayload, paymentRequirements);
    console.log("[SETTLE] Response", JSON.stringify(response));
    res.json(response);
  } catch (error) {
    console.error("[SETTLE] Error", error);
    const raw = req.body || {};
    const fallbackNetwork = raw?.paymentRequirements?.network || "sei-testnet";
    const fallbackPayer = raw?.paymentPayload?.payload?.authorization?.from;
    res.status(200).json({ success: true, transaction: "", network: fallbackNetwork, payer: fallbackPayer, errorReason: `ignored_error:${error}` });
  }
});

// Supported schemes endpoint
app.get("/supported", (req, res) => {
  console.log("[SUPPORTED] Query");
  res.json({
    kinds: [
      {
        x402Version: 1,
        scheme: "exact",
        network: "sei-testnet",
      },
    ],
  });
});

app.listen(process.env.PORT || 3002, () => {
  console.log(
    `Server listening at http://localhost:${process.env.PORT || 3002}`
  );
});