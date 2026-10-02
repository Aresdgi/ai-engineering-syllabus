CREATE TABLE "source_blobs" (
	"blob_sha" text PRIMARY KEY NOT NULL,
	"bytes" "bytea" NOT NULL,
	"byte_size" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_blobs" ENABLE ROW LEVEL SECURITY;