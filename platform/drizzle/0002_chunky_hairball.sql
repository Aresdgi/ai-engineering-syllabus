CREATE TABLE "external_archive_assets" (
	"sha256" text PRIMARY KEY NOT NULL,
	"bytes" "bytea" NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"source_url" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "external_archive_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "external_archive_item_assets" (
	"item_id" uuid NOT NULL,
	"asset_sha256" text NOT NULL,
	"original_url" text NOT NULL,
	"alt" text,
	CONSTRAINT "external_archive_item_assets_pk" PRIMARY KEY("item_id","original_url")
);
--> statement-breakpoint
ALTER TABLE "external_archive_item_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "external_archive_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"kind" text NOT NULL,
	"host" text NOT NULL,
	"language" text,
	"title" text,
	"content" text,
	"content_sha256" text,
	"content_format" text,
	"source_repository" text,
	"source_commit" text,
	"source_path" text,
	"captured_at" timestamp with time zone NOT NULL,
	"method" text NOT NULL,
	"http_status" integer,
	"wayback_url" text,
	"wayback_captured_at" timestamp with time zone,
	"wayback_http_status" integer,
	"status" text NOT NULL,
	"last_error" text,
	"alias_of_canonical_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_archive_items_canonical_url_unique" UNIQUE("canonical_url"),
	CONSTRAINT "external_archive_items_kind_allowed" CHECK ("external_archive_items"."kind" in ('lesson', 'tool')),
	CONSTRAINT "external_archive_items_status_allowed" CHECK ("external_archive_items"."status" in ('captured', 'unavailable', 'error', 'alias')),
	CONSTRAINT "external_archive_items_method_allowed" CHECK ("external_archive_items"."method" in ('registry-api+github-raw', 'wayback-metadata', 'manual', 'user-alias')),
	CONSTRAINT "external_archive_items_language_allowed" CHECK ("external_archive_items"."language" in ('es', 'en')),
	CONSTRAINT "external_archive_items_content_format_allowed" CHECK ("external_archive_items"."content_format" in ('markdown')),
	CONSTRAINT "external_archive_items_alias_iff_status" CHECK (("external_archive_items"."status" = 'alias') = ("external_archive_items"."alias_of_canonical_url" is not null))
);
--> statement-breakpoint
ALTER TABLE "external_archive_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "external_archive_item_assets" ADD CONSTRAINT "external_archive_item_assets_item_id_external_archive_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."external_archive_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_archive_item_assets" ADD CONSTRAINT "external_archive_item_assets_asset_sha256_external_archive_assets_sha256_fk" FOREIGN KEY ("asset_sha256") REFERENCES "public"."external_archive_assets"("sha256") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_archive_items_kind_idx" ON "external_archive_items" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "external_archive_items_status_idx" ON "external_archive_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "external_archive_items_host_idx" ON "external_archive_items" USING btree ("host");--> statement-breakpoint
CREATE INDEX "external_archive_items_language_idx" ON "external_archive_items" USING btree ("language");