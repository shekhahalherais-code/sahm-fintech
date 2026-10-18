import mongoose, { Schema } from "mongoose";

const financialMetricSchema = new Schema(
  {
    label: { type: String, required: true },
    category: {
      type: String,
      enum: ["revenue", "net_profit", "assets", "liabilities", "equity", "other"],
      required: true,
    },
    reportedValue: { type: String, default: null },
    currency: { type: String, default: null },
    unitScale: {
      type: String,
      enum: ["units", "thousands", "millions", "unknown"],
      required: true,
    },
    reportingPeriod: { type: String, default: null },
    sourcePage: { type: Number, default: null },
    sourceExcerpt: { type: String, default: null },
    verificationStatus: {
      type: String,
      enum: ["verified", "unverified", "unavailable"],
      required: true,
    },
  },
  { _id: false },
);

const financialAnalysisSchema = new Schema(
  {
    originalFileName: { type: String, required: true },
    companyName: { type: String, default: null },
    reportingPeriod: { type: String, default: null },
    currency: { type: String, default: null },
    unitScale: {
      type: String,
      enum: ["units", "thousands", "millions", "unknown"],
      required: true,
    },
    metrics: { type: [financialMetricSchema], required: true },
    extractionNotes: { type: [String], default: [] },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

export const FinancialAnalysis =
  mongoose.models.FinancialAnalysis ??
  mongoose.model("FinancialAnalysis", financialAnalysisSchema);
