CREATE TABLE "source_contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"source_path" text NOT NULL,
	"title" text,
	"preferred_readme_path" text,
	"language" text,
	"language_evidence" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "source_contexts_snapshot_source_path_unique" UNIQUE("snapshot_id","source_path"),
	CONSTRAINT "source_contexts_language_evidence_allowed" CHECK (("source_contexts"."language" is null and "source_contexts"."language_evidence" is null) or ("source_contexts"."language" is not null and "source_contexts"."language_evidence" is not null and (("source_contexts"."language" = 'es' and "source_contexts"."language_evidence" = 'suffix') or ("source_contexts"."language" = 'en' and "source_contexts"."language_evidence" = 'suffix') or ("source_contexts"."language" = 'en' and "source_contexts"."language_evidence" = 'pair-convention'))))
);
--> statement-breakpoint
ALTER TABLE "source_contexts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"path" text NOT NULL,
	"blob_sha" text NOT NULL,
	"media_type" text NOT NULL,
	"language" text,
	"language_evidence" text,
	"raw_content" text,
	"binary_reference" text,
	CONSTRAINT "source_files_snapshot_path_unique" UNIQUE("snapshot_id","path"),
	CONSTRAINT "source_files_content_exactly_one" CHECK (("source_files"."raw_content" is null) <> ("source_files"."binary_reference" is null)),
	CONSTRAINT "source_files_language_evidence_allowed" CHECK (("source_files"."language" is null and "source_files"."language_evidence" is null) or ("source_files"."language" is not null and "source_files"."language_evidence" is not null and (("source_files"."language" = 'es' and "source_files"."language_evidence" = 'suffix') or ("source_files"."language" = 'en' and "source_files"."language_evidence" = 'suffix') or ("source_files"."language" = 'en' and "source_files"."language_evidence" = 'pair-convention'))))
);
--> statement-breakpoint
ALTER TABLE "source_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_import_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"source_path" text,
	"error_kind" text NOT NULL,
	"message" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_import_errors_kind_allowed" CHECK ("source_import_errors"."error_kind" in ('repository-resolution-failed', 'commit-resolution-failed', 'tree-truncated', 'tree-read-failed', 'file-read-failed', 'file-hash-mismatch', 'file-decode-failed', 'storage-write-failed', 'unexpected-error'))
);
--> statement-breakpoint
ALTER TABLE "source_import_errors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"source_path" text NOT NULL,
	"title" text,
	"preferred_readme_path" text,
	"language" text,
	"language_evidence" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "source_lessons_snapshot_source_path_unique" UNIQUE("snapshot_id","source_path"),
	CONSTRAINT "source_lessons_language_evidence_allowed" CHECK (("source_lessons"."language" is null and "source_lessons"."language_evidence" is null) or ("source_lessons"."language" is not null and "source_lessons"."language_evidence" is not null and (("source_lessons"."language" = 'es' and "source_lessons"."language_evidence" = 'suffix') or ("source_lessons"."language" = 'en' and "source_lessons"."language_evidence" = 'suffix') or ("source_lessons"."language" = 'en' and "source_lessons"."language_evidence" = 'pair-convention'))))
);
--> statement-breakpoint
ALTER TABLE "source_lessons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"source_path" text NOT NULL,
	"canonical_order" integer,
	"title" text,
	"preferred_readme_path" text,
	"language" text,
	"language_evidence" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "source_projects_snapshot_source_path_unique" UNIQUE("snapshot_id","source_path"),
	CONSTRAINT "source_projects_language_evidence_allowed" CHECK (("source_projects"."language" is null and "source_projects"."language_evidence" is null) or ("source_projects"."language" is not null and "source_projects"."language_evidence" is not null and (("source_projects"."language" = 'es' and "source_projects"."language_evidence" = 'suffix') or ("source_projects"."language" = 'en' and "source_projects"."language_evidence" = 'suffix') or ("source_projects"."language" = 'en' and "source_projects"."language_evidence" = 'pair-convention'))))
);
--> statement-breakpoint
ALTER TABLE "source_projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"canonical_url" text NOT NULL,
	"default_branch" text NOT NULL,
	CONSTRAINT "source_repositories_owner_name_unique" UNIQUE("owner","name")
);
--> statement-breakpoint
ALTER TABLE "source_repositories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"ref" text NOT NULL,
	"commit_sha" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'importing' NOT NULL,
	CONSTRAINT "source_snapshots_repository_commit_unique" UNIQUE("repository_id","commit_sha"),
	CONSTRAINT "source_snapshots_status_allowed" CHECK ("source_snapshots"."status" in ('importing', 'complete', 'complete_with_errors', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "source_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "source_contexts" ADD CONSTRAINT "source_contexts_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_import_errors" ADD CONSTRAINT "source_import_errors_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_lessons" ADD CONSTRAINT "source_lessons_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_projects" ADD CONSTRAINT "source_projects_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_snapshots" ADD CONSTRAINT "source_snapshots_repository_id_source_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."source_repositories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_import_errors_snapshot_id_idx" ON "source_import_errors" USING btree ("snapshot_id");