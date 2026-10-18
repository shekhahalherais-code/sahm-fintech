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

const explanationItemSchema = new Schema(
  {
    metricIndex: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ["revenue", "net_profit", "assets", "liabilities", "equity", "other"],
      required: true,
    },
    meaningEnglish: { type: String, required: true, maxlength: 500 },
    meaningArabic: { type: String, required: true, maxlength: 500 },
    contextEnglish: { type: String, required: true, maxlength: 500 },
    contextArabic: { type: String, required: true, maxlength: 500 },
    sourcePage: { type: Number, default: null },
  },
  { _id: false },
);

const explanationBundleSchema = new Schema(
  {
    summaryEnglish: { type: String, required: true, maxlength: 800 },
    summaryArabic: { type: String, required: true, maxlength: 800 },
    items: { type: [explanationItemSchema], required: true },
    generatedAt: { type: String, required: true },
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
    explanations: { type: explanationBundleSchema, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

export const FinancialAnalysis =
  mongoose.models.FinancialAnalysis ??
  mongoose.model("FinancialAnalysis", financialAnalysisSchema);
