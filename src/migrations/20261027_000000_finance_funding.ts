import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Project funding, advertising allocation, commission distribution, private finance
// proofs, change history, and the normalised lead phone used for repeat-enquiry badges.
//
// Generated from drizzle-kit's push diff against the previous schema (see
// scripts/_print-schema-diff.ts), limited to the finance and lead phone changes, then
// made repeatable. It only adds types, tables, columns, constraints and indexes, and
// backfills leads.phone_key. No existing finance record is changed: older deals without
// a commission split, receipts/expenses without an account, and deal expenses without a
// pre-distribution designation are left as they are and flagged in /finance.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
DO $$ BEGIN CREATE TYPE "public"."enum_finance_deals_commission_mode" AS ENUM('project-default', 'referral', 'custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_finance_expenses_payment_status" AS ENUM('paid', 'unpaid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_finance_accounts_opening_classification_purpose" AS ENUM('owner', 'commission', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_finance_accounts_kind" AS ENUM('bank', 'cash', 'card'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_finance_project_rules_presets_kind" AS ENUM('referral', 'custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_finance_campaigns_status" AS ENUM('active', 'completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_finance_funding_kind" AS ENUM('contribution', 'pledge', 'refund', 'adjustment', 'opening'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_finance_funding_direction" AS ENUM('increase', 'decrease'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."enum_finance_transfers_kind" AS ENUM('transfer', 'card-settlement'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS "finance_deals_commission_split" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "key" varchar,
  "participant_id" integer,
  "recipient_name" varchar,
  "percent" numeric NOT NULL,
  "role" varchar
);
CREATE TABLE IF NOT EXISTS "finance_receipts_rels" (
  "id" serial PRIMARY KEY NOT NULL,
  "order" integer,
  "parent_id" integer NOT NULL,
  "path" varchar NOT NULL,
  "finance_files_id" integer
);
CREATE TABLE IF NOT EXISTS "finance_expenses_rels" (
  "id" serial PRIMARY KEY NOT NULL,
  "order" integer,
  "parent_id" integer NOT NULL,
  "path" varchar NOT NULL,
  "finance_files_id" integer
);
CREATE TABLE IF NOT EXISTS "finance_participants" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  "phone" varchar,
  "is_owner" boolean DEFAULT false,
  "archived" boolean DEFAULT false,
  "notes" varchar,
  "entry_key" varchar,
  "created_by_id" integer,
  "updated_by_id" integer,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "finance_accounts_opening_classification" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "purpose" "enum_finance_accounts_opening_classification_purpose" DEFAULT 'owner' NOT NULL,
  "amount" numeric DEFAULT 0 NOT NULL,
  "note" varchar
);
CREATE TABLE IF NOT EXISTS "finance_accounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  "kind" "enum_finance_accounts_kind" DEFAULT 'bank' NOT NULL,
  "card_label" varchar,
  "opening_balance" numeric DEFAULT 0,
  "opening_date" timestamp(3) with time zone NOT NULL,
  "archived" boolean DEFAULT false,
  "notes" varchar,
  "change_reason" varchar,
  "entry_key" varchar,
  "created_by_id" integer,
  "updated_by_id" integer,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "finance_project_rules_funding" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "participant_id" integer NOT NULL,
  "percent" numeric NOT NULL
);
CREATE TABLE IF NOT EXISTS "finance_project_rules_commission" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "key" varchar,
  "participant_id" integer,
  "recipient_name" varchar,
  "percent" numeric NOT NULL,
  "role" varchar
);
CREATE TABLE IF NOT EXISTS "finance_project_rules_presets_lines" (
  "_order" integer NOT NULL,
  "_parent_id" varchar NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "key" varchar,
  "participant_id" integer,
  "recipient_name" varchar,
  "percent" numeric NOT NULL,
  "role" varchar
);
CREATE TABLE IF NOT EXISTS "finance_project_rules_presets" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  "kind" "enum_finance_project_rules_presets_kind" DEFAULT 'custom' NOT NULL
);
CREATE TABLE IF NOT EXISTS "finance_project_rules" (
  "id" serial PRIMARY KEY NOT NULL,
  "project_id" integer NOT NULL,
  "planned_daily_budget" numeric DEFAULT 5000,
  "notes" varchar,
  "change_reason" varchar,
  "entry_key" varchar,
  "created_by_id" integer,
  "updated_by_id" integer,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "finance_campaigns" (
  "id" serial PRIMARY KEY NOT NULL,
  "project_id" integer NOT NULL,
  "name" varchar NOT NULL,
  "meta_campaign_id" varchar,
  "start_at" timestamp(3) with time zone NOT NULL,
  "end_at" timestamp(3) with time zone,
  "daily_budget" numeric NOT NULL,
  "funding_target" numeric,
  "status" "enum_finance_campaigns_status" DEFAULT 'active' NOT NULL,
  "notes" varchar,
  "entry_key" varchar,
  "created_by_id" integer,
  "updated_by_id" integer,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "finance_funding" (
  "id" serial PRIMARY KEY NOT NULL,
  "kind" "enum_finance_funding_kind" DEFAULT 'contribution' NOT NULL,
  "direction" "enum_finance_funding_direction" DEFAULT 'increase' NOT NULL,
  "participant_id" integer NOT NULL,
  "project_id" integer NOT NULL,
  "campaign_id" integer,
  "pledge_id" integer,
  "amount" numeric NOT NULL,
  "date" timestamp(3) with time zone NOT NULL,
  "account_id" integer,
  "payment_method" varchar,
  "reference" varchar,
  "notes" varchar,
  "entry_key" varchar,
  "voided" boolean DEFAULT false,
  "void_reason" varchar,
  "created_by_id" integer,
  "updated_by_id" integer,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "finance_funding_rels" (
  "id" serial PRIMARY KEY NOT NULL,
  "order" integer,
  "parent_id" integer NOT NULL,
  "path" varchar NOT NULL,
  "finance_files_id" integer
);
CREATE TABLE IF NOT EXISTS "finance_ad_charges_lines" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "campaign_id" integer NOT NULL,
  "project_id" integer,
  "meta_receipt" varchar,
  "meta_amount" numeric NOT NULL,
  "additional_charges" numeric,
  "total_cost" numeric
);
CREATE TABLE IF NOT EXISTS "finance_ad_charges_shares" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "line" numeric,
  "project_id" integer,
  "campaign_id" integer,
  "participant_id" integer,
  "percent" numeric,
  "amount" numeric
);
CREATE TABLE IF NOT EXISTS "finance_ad_charges" (
  "id" serial PRIMARY KEY NOT NULL,
  "date" timestamp(3) with time zone NOT NULL,
  "account_id" integer NOT NULL,
  "card_label" varchar,
  "bank_debit" numeric NOT NULL,
  "meta_reference" varchar,
  "charge_breakdown" varchar,
  "meta_total" numeric,
  "additional_total" numeric,
  "review_flags" varchar,
  "notes" varchar,
  "entry_key" varchar,
  "voided" boolean DEFAULT false,
  "void_reason" varchar,
  "created_by_id" integer,
  "updated_by_id" integer,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "finance_ad_charges_rels" (
  "id" serial PRIMARY KEY NOT NULL,
  "order" integer,
  "parent_id" integer NOT NULL,
  "path" varchar NOT NULL,
  "finance_files_id" integer
);
CREATE TABLE IF NOT EXISTS "finance_payouts" (
  "id" serial PRIMARY KEY NOT NULL,
  "deal_id" integer NOT NULL,
  "recipient_key" varchar NOT NULL,
  "recipient_name" varchar,
  "participant_id" integer,
  "amount" numeric NOT NULL,
  "date" timestamp(3) with time zone NOT NULL,
  "account_id" integer NOT NULL,
  "payment_method" varchar,
  "reference" varchar,
  "notes" varchar,
  "entry_key" varchar,
  "voided" boolean DEFAULT false,
  "void_reason" varchar,
  "created_by_id" integer,
  "updated_by_id" integer,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "finance_payouts_rels" (
  "id" serial PRIMARY KEY NOT NULL,
  "order" integer,
  "parent_id" integer NOT NULL,
  "path" varchar NOT NULL,
  "finance_files_id" integer
);
CREATE TABLE IF NOT EXISTS "finance_transfers" (
  "id" serial PRIMARY KEY NOT NULL,
  "date" timestamp(3) with time zone NOT NULL,
  "from_account_id" integer NOT NULL,
  "to_account_id" integer NOT NULL,
  "amount" numeric NOT NULL,
  "kind" "enum_finance_transfers_kind" DEFAULT 'transfer' NOT NULL,
  "reference" varchar,
  "notes" varchar,
  "entry_key" varchar,
  "voided" boolean DEFAULT false,
  "void_reason" varchar,
  "created_by_id" integer,
  "updated_by_id" integer,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "finance_transfers_rels" (
  "id" serial PRIMARY KEY NOT NULL,
  "order" integer,
  "parent_id" integer NOT NULL,
  "path" varchar NOT NULL,
  "finance_files_id" integer
);
CREATE TABLE IF NOT EXISTS "finance_statements" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL,
  "date" timestamp(3) with time zone NOT NULL,
  "statement_balance" numeric DEFAULT 0 NOT NULL,
  "notes" varchar,
  "entry_key" varchar,
  "created_by_id" integer,
  "updated_by_id" integer,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "finance_statements_rels" (
  "id" serial PRIMARY KEY NOT NULL,
  "order" integer,
  "parent_id" integer NOT NULL,
  "path" varchar NOT NULL,
  "finance_files_id" integer
);
CREATE TABLE IF NOT EXISTS "finance_files" (
  "id" serial PRIMARY KEY NOT NULL,
  "description" varchar,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "url" varchar,
  "thumbnail_u_r_l" varchar,
  "filename" varchar,
  "mime_type" varchar,
  "filesize" numeric,
  "width" numeric,
  "height" numeric,
  "focal_x" numeric,
  "focal_y" numeric
);
CREATE TABLE IF NOT EXISTS "finance_audit_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "target_collection" varchar NOT NULL,
  "target_id" varchar NOT NULL,
  "operation" varchar NOT NULL,
  "changes" jsonb,
  "reason" varchar,
  "user_id" integer,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "finance_receipts" ADD COLUMN IF NOT EXISTS "account_id" integer;
ALTER TABLE "finance_expenses" ADD COLUMN IF NOT EXISTS "pre_distribution" boolean;
ALTER TABLE "finance_expenses" ADD COLUMN IF NOT EXISTS "payment_status" "enum_finance_expenses_payment_status";
ALTER TABLE "finance_expenses" ADD COLUMN IF NOT EXISTS "paid_date" timestamp(3) with time zone;
ALTER TABLE "finance_expenses" ADD COLUMN IF NOT EXISTS "reference" varchar;
ALTER TABLE "finance_expenses" ADD COLUMN IF NOT EXISTS "account_id" integer;
ALTER TABLE "finance_deals" ADD COLUMN IF NOT EXISTS "campaign_id" integer;
ALTER TABLE "finance_deals" ADD COLUMN IF NOT EXISTS "commission_mode" "enum_finance_deals_commission_mode";
ALTER TABLE "finance_deals" ADD COLUMN IF NOT EXISTS "referrer_name" varchar;
ALTER TABLE "finance_deals" ADD COLUMN IF NOT EXISTS "change_reason" varchar;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "phone_key" varchar;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "finance_participants_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "finance_accounts_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "finance_project_rules_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "finance_campaigns_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "finance_funding_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "finance_ad_charges_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "finance_payouts_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "finance_transfers_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "finance_statements_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "finance_files_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "finance_audit_log_id" integer;
DO $$ BEGIN ALTER TABLE "finance_deals_commission_split" ADD CONSTRAINT "finance_deals_commission_split_participant_id_finance_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."finance_participants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_deals_commission_split" ADD CONSTRAINT "finance_deals_commission_split_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."finance_deals"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_receipts_rels" ADD CONSTRAINT "finance_receipts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."finance_receipts"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_receipts_rels" ADD CONSTRAINT "finance_receipts_rels_finance_files_fk" FOREIGN KEY ("finance_files_id") REFERENCES "public"."finance_files"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_expenses_rels" ADD CONSTRAINT "finance_expenses_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."finance_expenses"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_expenses_rels" ADD CONSTRAINT "finance_expenses_rels_finance_files_fk" FOREIGN KEY ("finance_files_id") REFERENCES "public"."finance_files"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_participants" ADD CONSTRAINT "finance_participants_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_participants" ADD CONSTRAINT "finance_participants_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_accounts_opening_classification" ADD CONSTRAINT "finance_accounts_opening_classification_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."finance_accounts"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_accounts" ADD CONSTRAINT "finance_accounts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_accounts" ADD CONSTRAINT "finance_accounts_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_project_rules_funding" ADD CONSTRAINT "finance_project_rules_funding_participant_id_finance_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."finance_participants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_project_rules_funding" ADD CONSTRAINT "finance_project_rules_funding_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."finance_project_rules"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_project_rules_commission" ADD CONSTRAINT "finance_project_rules_commission_participant_id_finance_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."finance_participants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_project_rules_commission" ADD CONSTRAINT "finance_project_rules_commission_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."finance_project_rules"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_project_rules_presets_lines" ADD CONSTRAINT "finance_project_rules_presets_lines_participant_id_finance_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."finance_participants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_project_rules_presets_lines" ADD CONSTRAINT "finance_project_rules_presets_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."finance_project_rules_presets"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_project_rules_presets" ADD CONSTRAINT "finance_project_rules_presets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."finance_project_rules"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_project_rules" ADD CONSTRAINT "finance_project_rules_project_id_featured_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."featured_projects"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_project_rules" ADD CONSTRAINT "finance_project_rules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_project_rules" ADD CONSTRAINT "finance_project_rules_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_campaigns" ADD CONSTRAINT "finance_campaigns_project_id_featured_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."featured_projects"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_campaigns" ADD CONSTRAINT "finance_campaigns_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_campaigns" ADD CONSTRAINT "finance_campaigns_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_funding" ADD CONSTRAINT "finance_funding_participant_id_finance_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."finance_participants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_funding" ADD CONSTRAINT "finance_funding_project_id_featured_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."featured_projects"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_funding" ADD CONSTRAINT "finance_funding_campaign_id_finance_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."finance_campaigns"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_funding" ADD CONSTRAINT "finance_funding_pledge_id_finance_funding_id_fk" FOREIGN KEY ("pledge_id") REFERENCES "public"."finance_funding"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_funding" ADD CONSTRAINT "finance_funding_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_funding" ADD CONSTRAINT "finance_funding_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_funding" ADD CONSTRAINT "finance_funding_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_funding_rels" ADD CONSTRAINT "finance_funding_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."finance_funding"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_funding_rels" ADD CONSTRAINT "finance_funding_rels_finance_files_fk" FOREIGN KEY ("finance_files_id") REFERENCES "public"."finance_files"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_ad_charges_lines" ADD CONSTRAINT "finance_ad_charges_lines_campaign_id_finance_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."finance_campaigns"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_ad_charges_lines" ADD CONSTRAINT "finance_ad_charges_lines_project_id_featured_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."featured_projects"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_ad_charges_lines" ADD CONSTRAINT "finance_ad_charges_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."finance_ad_charges"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_ad_charges_shares" ADD CONSTRAINT "finance_ad_charges_shares_project_id_featured_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."featured_projects"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_ad_charges_shares" ADD CONSTRAINT "finance_ad_charges_shares_campaign_id_finance_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."finance_campaigns"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_ad_charges_shares" ADD CONSTRAINT "finance_ad_charges_shares_participant_id_finance_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."finance_participants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_ad_charges_shares" ADD CONSTRAINT "finance_ad_charges_shares_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."finance_ad_charges"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_ad_charges" ADD CONSTRAINT "finance_ad_charges_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_ad_charges" ADD CONSTRAINT "finance_ad_charges_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_ad_charges" ADD CONSTRAINT "finance_ad_charges_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_ad_charges_rels" ADD CONSTRAINT "finance_ad_charges_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."finance_ad_charges"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_ad_charges_rels" ADD CONSTRAINT "finance_ad_charges_rels_finance_files_fk" FOREIGN KEY ("finance_files_id") REFERENCES "public"."finance_files"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_payouts" ADD CONSTRAINT "finance_payouts_deal_id_finance_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."finance_deals"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_payouts" ADD CONSTRAINT "finance_payouts_participant_id_finance_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."finance_participants"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_payouts" ADD CONSTRAINT "finance_payouts_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_payouts" ADD CONSTRAINT "finance_payouts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_payouts" ADD CONSTRAINT "finance_payouts_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_payouts_rels" ADD CONSTRAINT "finance_payouts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."finance_payouts"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_payouts_rels" ADD CONSTRAINT "finance_payouts_rels_finance_files_fk" FOREIGN KEY ("finance_files_id") REFERENCES "public"."finance_files"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_transfers" ADD CONSTRAINT "finance_transfers_from_account_id_finance_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_transfers" ADD CONSTRAINT "finance_transfers_to_account_id_finance_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_transfers" ADD CONSTRAINT "finance_transfers_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_transfers" ADD CONSTRAINT "finance_transfers_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_transfers_rels" ADD CONSTRAINT "finance_transfers_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."finance_transfers"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_transfers_rels" ADD CONSTRAINT "finance_transfers_rels_finance_files_fk" FOREIGN KEY ("finance_files_id") REFERENCES "public"."finance_files"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_statements" ADD CONSTRAINT "finance_statements_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_statements" ADD CONSTRAINT "finance_statements_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_statements" ADD CONSTRAINT "finance_statements_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_statements_rels" ADD CONSTRAINT "finance_statements_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."finance_statements"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_statements_rels" ADD CONSTRAINT "finance_statements_rels_finance_files_fk" FOREIGN KEY ("finance_files_id") REFERENCES "public"."finance_files"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_audit_log" ADD CONSTRAINT "finance_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "finance_deals_commission_split_order_idx" ON "finance_deals_commission_split" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "finance_deals_commission_split_parent_id_idx" ON "finance_deals_commission_split" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "finance_deals_commission_split_participant_idx" ON "finance_deals_commission_split" USING btree ("participant_id");
CREATE INDEX IF NOT EXISTS "finance_receipts_rels_order_idx" ON "finance_receipts_rels" USING btree ("order");
CREATE INDEX IF NOT EXISTS "finance_receipts_rels_parent_idx" ON "finance_receipts_rels" USING btree ("parent_id");
CREATE INDEX IF NOT EXISTS "finance_receipts_rels_path_idx" ON "finance_receipts_rels" USING btree ("path");
CREATE INDEX IF NOT EXISTS "finance_receipts_rels_finance_files_id_idx" ON "finance_receipts_rels" USING btree ("finance_files_id");
CREATE INDEX IF NOT EXISTS "finance_expenses_rels_order_idx" ON "finance_expenses_rels" USING btree ("order");
CREATE INDEX IF NOT EXISTS "finance_expenses_rels_parent_idx" ON "finance_expenses_rels" USING btree ("parent_id");
CREATE INDEX IF NOT EXISTS "finance_expenses_rels_path_idx" ON "finance_expenses_rels" USING btree ("path");
CREATE INDEX IF NOT EXISTS "finance_expenses_rels_finance_files_id_idx" ON "finance_expenses_rels" USING btree ("finance_files_id");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_participants_entry_key_idx" ON "finance_participants" USING btree ("entry_key");
CREATE INDEX IF NOT EXISTS "finance_participants_created_by_idx" ON "finance_participants" USING btree ("created_by_id");
CREATE INDEX IF NOT EXISTS "finance_participants_updated_by_idx" ON "finance_participants" USING btree ("updated_by_id");
CREATE INDEX IF NOT EXISTS "finance_participants_updated_at_idx" ON "finance_participants" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "finance_participants_created_at_idx" ON "finance_participants" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "finance_accounts_opening_classification_order_idx" ON "finance_accounts_opening_classification" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "finance_accounts_opening_classification_parent_id_idx" ON "finance_accounts_opening_classification" USING btree ("_parent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_accounts_entry_key_idx" ON "finance_accounts" USING btree ("entry_key");
CREATE INDEX IF NOT EXISTS "finance_accounts_created_by_idx" ON "finance_accounts" USING btree ("created_by_id");
CREATE INDEX IF NOT EXISTS "finance_accounts_updated_by_idx" ON "finance_accounts" USING btree ("updated_by_id");
CREATE INDEX IF NOT EXISTS "finance_accounts_updated_at_idx" ON "finance_accounts" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "finance_accounts_created_at_idx" ON "finance_accounts" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "finance_project_rules_funding_order_idx" ON "finance_project_rules_funding" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "finance_project_rules_funding_parent_id_idx" ON "finance_project_rules_funding" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "finance_project_rules_funding_participant_idx" ON "finance_project_rules_funding" USING btree ("participant_id");
CREATE INDEX IF NOT EXISTS "finance_project_rules_commission_order_idx" ON "finance_project_rules_commission" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "finance_project_rules_commission_parent_id_idx" ON "finance_project_rules_commission" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "finance_project_rules_commission_participant_idx" ON "finance_project_rules_commission" USING btree ("participant_id");
CREATE INDEX IF NOT EXISTS "finance_project_rules_presets_lines_order_idx" ON "finance_project_rules_presets_lines" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "finance_project_rules_presets_lines_parent_id_idx" ON "finance_project_rules_presets_lines" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "finance_project_rules_presets_lines_participant_idx" ON "finance_project_rules_presets_lines" USING btree ("participant_id");
CREATE INDEX IF NOT EXISTS "finance_project_rules_presets_order_idx" ON "finance_project_rules_presets" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "finance_project_rules_presets_parent_id_idx" ON "finance_project_rules_presets" USING btree ("_parent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_project_rules_project_idx" ON "finance_project_rules" USING btree ("project_id");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_project_rules_entry_key_idx" ON "finance_project_rules" USING btree ("entry_key");
CREATE INDEX IF NOT EXISTS "finance_project_rules_created_by_idx" ON "finance_project_rules" USING btree ("created_by_id");
CREATE INDEX IF NOT EXISTS "finance_project_rules_updated_by_idx" ON "finance_project_rules" USING btree ("updated_by_id");
CREATE INDEX IF NOT EXISTS "finance_project_rules_updated_at_idx" ON "finance_project_rules" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "finance_project_rules_created_at_idx" ON "finance_project_rules" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "finance_campaigns_project_idx" ON "finance_campaigns" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "finance_campaigns_start_at_idx" ON "finance_campaigns" USING btree ("start_at");
CREATE INDEX IF NOT EXISTS "finance_campaigns_end_at_idx" ON "finance_campaigns" USING btree ("end_at");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_campaigns_entry_key_idx" ON "finance_campaigns" USING btree ("entry_key");
CREATE INDEX IF NOT EXISTS "finance_campaigns_created_by_idx" ON "finance_campaigns" USING btree ("created_by_id");
CREATE INDEX IF NOT EXISTS "finance_campaigns_updated_by_idx" ON "finance_campaigns" USING btree ("updated_by_id");
CREATE INDEX IF NOT EXISTS "finance_campaigns_updated_at_idx" ON "finance_campaigns" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "finance_campaigns_created_at_idx" ON "finance_campaigns" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "finance_funding_participant_idx" ON "finance_funding" USING btree ("participant_id");
CREATE INDEX IF NOT EXISTS "finance_funding_project_idx" ON "finance_funding" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "finance_funding_campaign_idx" ON "finance_funding" USING btree ("campaign_id");
CREATE INDEX IF NOT EXISTS "finance_funding_pledge_idx" ON "finance_funding" USING btree ("pledge_id");
CREATE INDEX IF NOT EXISTS "finance_funding_date_idx" ON "finance_funding" USING btree ("date");
CREATE INDEX IF NOT EXISTS "finance_funding_account_idx" ON "finance_funding" USING btree ("account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_funding_entry_key_idx" ON "finance_funding" USING btree ("entry_key");
CREATE INDEX IF NOT EXISTS "finance_funding_created_by_idx" ON "finance_funding" USING btree ("created_by_id");
CREATE INDEX IF NOT EXISTS "finance_funding_updated_by_idx" ON "finance_funding" USING btree ("updated_by_id");
CREATE INDEX IF NOT EXISTS "finance_funding_updated_at_idx" ON "finance_funding" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "finance_funding_created_at_idx" ON "finance_funding" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "finance_funding_rels_order_idx" ON "finance_funding_rels" USING btree ("order");
CREATE INDEX IF NOT EXISTS "finance_funding_rels_parent_idx" ON "finance_funding_rels" USING btree ("parent_id");
CREATE INDEX IF NOT EXISTS "finance_funding_rels_path_idx" ON "finance_funding_rels" USING btree ("path");
CREATE INDEX IF NOT EXISTS "finance_funding_rels_finance_files_id_idx" ON "finance_funding_rels" USING btree ("finance_files_id");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_lines_order_idx" ON "finance_ad_charges_lines" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_lines_parent_id_idx" ON "finance_ad_charges_lines" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_lines_campaign_idx" ON "finance_ad_charges_lines" USING btree ("campaign_id");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_lines_project_idx" ON "finance_ad_charges_lines" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_shares_order_idx" ON "finance_ad_charges_shares" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_shares_parent_id_idx" ON "finance_ad_charges_shares" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_shares_project_idx" ON "finance_ad_charges_shares" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_shares_campaign_idx" ON "finance_ad_charges_shares" USING btree ("campaign_id");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_shares_participant_idx" ON "finance_ad_charges_shares" USING btree ("participant_id");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_date_idx" ON "finance_ad_charges" USING btree ("date");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_account_idx" ON "finance_ad_charges" USING btree ("account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_ad_charges_entry_key_idx" ON "finance_ad_charges" USING btree ("entry_key");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_created_by_idx" ON "finance_ad_charges" USING btree ("created_by_id");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_updated_by_idx" ON "finance_ad_charges" USING btree ("updated_by_id");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_updated_at_idx" ON "finance_ad_charges" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_created_at_idx" ON "finance_ad_charges" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_rels_order_idx" ON "finance_ad_charges_rels" USING btree ("order");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_rels_parent_idx" ON "finance_ad_charges_rels" USING btree ("parent_id");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_rels_path_idx" ON "finance_ad_charges_rels" USING btree ("path");
CREATE INDEX IF NOT EXISTS "finance_ad_charges_rels_finance_files_id_idx" ON "finance_ad_charges_rels" USING btree ("finance_files_id");
CREATE INDEX IF NOT EXISTS "finance_payouts_deal_idx" ON "finance_payouts" USING btree ("deal_id");
CREATE INDEX IF NOT EXISTS "finance_payouts_participant_idx" ON "finance_payouts" USING btree ("participant_id");
CREATE INDEX IF NOT EXISTS "finance_payouts_date_idx" ON "finance_payouts" USING btree ("date");
CREATE INDEX IF NOT EXISTS "finance_payouts_account_idx" ON "finance_payouts" USING btree ("account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_payouts_entry_key_idx" ON "finance_payouts" USING btree ("entry_key");
CREATE INDEX IF NOT EXISTS "finance_payouts_created_by_idx" ON "finance_payouts" USING btree ("created_by_id");
CREATE INDEX IF NOT EXISTS "finance_payouts_updated_by_idx" ON "finance_payouts" USING btree ("updated_by_id");
CREATE INDEX IF NOT EXISTS "finance_payouts_updated_at_idx" ON "finance_payouts" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "finance_payouts_created_at_idx" ON "finance_payouts" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "finance_payouts_rels_order_idx" ON "finance_payouts_rels" USING btree ("order");
CREATE INDEX IF NOT EXISTS "finance_payouts_rels_parent_idx" ON "finance_payouts_rels" USING btree ("parent_id");
CREATE INDEX IF NOT EXISTS "finance_payouts_rels_path_idx" ON "finance_payouts_rels" USING btree ("path");
CREATE INDEX IF NOT EXISTS "finance_payouts_rels_finance_files_id_idx" ON "finance_payouts_rels" USING btree ("finance_files_id");
CREATE INDEX IF NOT EXISTS "finance_transfers_date_idx" ON "finance_transfers" USING btree ("date");
CREATE INDEX IF NOT EXISTS "finance_transfers_from_account_idx" ON "finance_transfers" USING btree ("from_account_id");
CREATE INDEX IF NOT EXISTS "finance_transfers_to_account_idx" ON "finance_transfers" USING btree ("to_account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_transfers_entry_key_idx" ON "finance_transfers" USING btree ("entry_key");
CREATE INDEX IF NOT EXISTS "finance_transfers_created_by_idx" ON "finance_transfers" USING btree ("created_by_id");
CREATE INDEX IF NOT EXISTS "finance_transfers_updated_by_idx" ON "finance_transfers" USING btree ("updated_by_id");
CREATE INDEX IF NOT EXISTS "finance_transfers_updated_at_idx" ON "finance_transfers" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "finance_transfers_created_at_idx" ON "finance_transfers" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "finance_transfers_rels_order_idx" ON "finance_transfers_rels" USING btree ("order");
CREATE INDEX IF NOT EXISTS "finance_transfers_rels_parent_idx" ON "finance_transfers_rels" USING btree ("parent_id");
CREATE INDEX IF NOT EXISTS "finance_transfers_rels_path_idx" ON "finance_transfers_rels" USING btree ("path");
CREATE INDEX IF NOT EXISTS "finance_transfers_rels_finance_files_id_idx" ON "finance_transfers_rels" USING btree ("finance_files_id");
CREATE INDEX IF NOT EXISTS "finance_statements_account_idx" ON "finance_statements" USING btree ("account_id");
CREATE INDEX IF NOT EXISTS "finance_statements_date_idx" ON "finance_statements" USING btree ("date");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_statements_entry_key_idx" ON "finance_statements" USING btree ("entry_key");
CREATE INDEX IF NOT EXISTS "finance_statements_created_by_idx" ON "finance_statements" USING btree ("created_by_id");
CREATE INDEX IF NOT EXISTS "finance_statements_updated_by_idx" ON "finance_statements" USING btree ("updated_by_id");
CREATE INDEX IF NOT EXISTS "finance_statements_updated_at_idx" ON "finance_statements" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "finance_statements_created_at_idx" ON "finance_statements" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "finance_statements_rels_order_idx" ON "finance_statements_rels" USING btree ("order");
CREATE INDEX IF NOT EXISTS "finance_statements_rels_parent_idx" ON "finance_statements_rels" USING btree ("parent_id");
CREATE INDEX IF NOT EXISTS "finance_statements_rels_path_idx" ON "finance_statements_rels" USING btree ("path");
CREATE INDEX IF NOT EXISTS "finance_statements_rels_finance_files_id_idx" ON "finance_statements_rels" USING btree ("finance_files_id");
CREATE INDEX IF NOT EXISTS "finance_files_updated_at_idx" ON "finance_files" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "finance_files_created_at_idx" ON "finance_files" USING btree ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_files_filename_idx" ON "finance_files" USING btree ("filename");
CREATE INDEX IF NOT EXISTS "finance_audit_log_target_collection_idx" ON "finance_audit_log" USING btree ("target_collection");
CREATE INDEX IF NOT EXISTS "finance_audit_log_target_id_idx" ON "finance_audit_log" USING btree ("target_id");
CREATE INDEX IF NOT EXISTS "finance_audit_log_user_idx" ON "finance_audit_log" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "finance_audit_log_updated_at_idx" ON "finance_audit_log" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "finance_audit_log_created_at_idx" ON "finance_audit_log" USING btree ("created_at");
DO $$ BEGIN ALTER TABLE "finance_receipts" ADD CONSTRAINT "finance_receipts_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "finance_deals" ADD CONSTRAINT "finance_deals_campaign_id_finance_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."finance_campaigns"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_finance_participants_fk" FOREIGN KEY ("finance_participants_id") REFERENCES "public"."finance_participants"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_finance_accounts_fk" FOREIGN KEY ("finance_accounts_id") REFERENCES "public"."finance_accounts"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_finance_project_rules_fk" FOREIGN KEY ("finance_project_rules_id") REFERENCES "public"."finance_project_rules"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_finance_campaigns_fk" FOREIGN KEY ("finance_campaigns_id") REFERENCES "public"."finance_campaigns"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_finance_funding_fk" FOREIGN KEY ("finance_funding_id") REFERENCES "public"."finance_funding"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_finance_ad_charges_fk" FOREIGN KEY ("finance_ad_charges_id") REFERENCES "public"."finance_ad_charges"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_finance_payouts_fk" FOREIGN KEY ("finance_payouts_id") REFERENCES "public"."finance_payouts"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_finance_transfers_fk" FOREIGN KEY ("finance_transfers_id") REFERENCES "public"."finance_transfers"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_finance_statements_fk" FOREIGN KEY ("finance_statements_id") REFERENCES "public"."finance_statements"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_finance_files_fk" FOREIGN KEY ("finance_files_id") REFERENCES "public"."finance_files"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_finance_audit_log_fk" FOREIGN KEY ("finance_audit_log_id") REFERENCES "public"."finance_audit_log"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "finance_receipts_account_idx" ON "finance_receipts" USING btree ("account_id");
CREATE INDEX IF NOT EXISTS "finance_expenses_account_idx" ON "finance_expenses" USING btree ("account_id");
CREATE INDEX IF NOT EXISTS "finance_deals_campaign_idx" ON "finance_deals" USING btree ("campaign_id");
CREATE INDEX IF NOT EXISTS "leads_phone_key_idx" ON "leads" USING btree ("phone_key");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_finance_participants_id_idx" ON "payload_locked_documents_rels" USING btree ("finance_participants_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_finance_accounts_id_idx" ON "payload_locked_documents_rels" USING btree ("finance_accounts_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_finance_project_rules_id_idx" ON "payload_locked_documents_rels" USING btree ("finance_project_rules_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_finance_campaigns_id_idx" ON "payload_locked_documents_rels" USING btree ("finance_campaigns_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_finance_funding_id_idx" ON "payload_locked_documents_rels" USING btree ("finance_funding_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_finance_ad_charges_id_idx" ON "payload_locked_documents_rels" USING btree ("finance_ad_charges_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_finance_payouts_id_idx" ON "payload_locked_documents_rels" USING btree ("finance_payouts_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_finance_transfers_id_idx" ON "payload_locked_documents_rels" USING btree ("finance_transfers_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_finance_statements_id_idx" ON "payload_locked_documents_rels" USING btree ("finance_statements_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_finance_files_id_idx" ON "payload_locked_documents_rels" USING btree ("finance_files_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_finance_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("finance_audit_log_id");
`))
  // With R2 enabled, the storage plugin stores each finance file's key prefix.
  await db.execute(sql`ALTER TABLE "finance_files" ADD COLUMN IF NOT EXISTS "prefix" varchar`)
  // Same normalisation as src/lib/phone-key.ts for the formats stored today. Saving a lead
  // recomputes it with libphonenumber; anything not recognised stays NULL and never matches.
  await db.execute(sql`
    UPDATE leads l SET phone_key = CASE
      WHEN n.s ~ '^\\+92[0-9]{10}$' THEN n.s
      WHEN n.s ~ '^0092[0-9]{10}$' THEN '+' || substr(n.s, 3)
      WHEN n.s ~ '^92[0-9]{10}$' THEN '+' || n.s
      WHEN n.s ~ '^0[0-9]{10}$' THEN '+92' || substr(n.s, 2)
      WHEN n.s ~ '^\\+[1-9][0-9]{7,14}$' THEN n.s
      ELSE NULL END
    FROM (SELECT id, regexp_replace(phone, '[[:space:]().-]', '', 'g') AS s FROM leads) n
    WHERE n.id = l.id AND l.phone_key IS NULL
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    'Finance funding records are preserved. Back up and remove the schema by hand if this must be rolled back.',
  )
}
