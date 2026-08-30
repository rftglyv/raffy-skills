# Layer: File storage

**Never proxy uploads through your API server** when you can avoid it — issue a presigned URL and
let the client upload directly. Proxying burns memory and request time, and it is the default
pattern in AI-generated code.

Validate on the server regardless: content type, size limit, and a filename you generate rather
than one the user supplied. A user-supplied path is a directory-traversal vulnerability.

### S3-compatible object storage (R2 · S3 · MinIO · B2)
**Bun:** full — bun has a built-in S3 client · **Docs:** https://developers.cloudflare.com/r2
**Teaches:** object-storage, presigned-urls, cdn, buckets
**Use when** — the default for any user upload. **Cloudflare R2 is the standout for most projects
because egress is free**, which is the cost that surprises people on S3. MinIO for self-hosted and
local development against the same API.
**Don't use when** — a handful of small files where the database is genuinely simpler.
**Adopt:** ~2h · **Remove later:** ~a day
**Gotcha:** buckets are public by default in more setups than you would expect. Verify. A public
bucket of user uploads is a data breach with no attacker required.

### UploadThing
**Docs:** https://docs.uploadthing.com · **Teaches:** upload-flows, presigned-urls
Managed uploads for TypeScript apps with the presigned flow and type-safe callbacks handled.
**Use when** — you want uploads working in an hour and do not want to think about buckets.
**Don't use when** — large volumes, where the managed price stops making sense.

### Database blobs
**Docs:** n/a — a column type.
**Use when** — small files, few of them, and transactional consistency with a row genuinely matters.
**Don't use when** — images, video, or anything a user uploads repeatedly. Backups become enormous
and slow.

### Local disk
**Docs:** n/a — the filesystem.
**Use when** — a single-server deployment with a persistent volume, or development.
**Don't use when** — more than one instance, containers without volumes, or any serverless platform.
Files vanish on redeploy, which is discovered in production.

### Image processing and delivery
**Docs:** https://sharp.pixelplumbing.com · https://developers.cloudflare.com/images
**Teaches:** image-optimization, cdn, responsive-images
**Use when** — users upload images. Resize and re-encode on upload, never serve originals.
**Gotcha:** `sharp` is a **native node-gyp addon** and is the most likely thing to fail under bun.
Cloudflare Images, imgproxy, or a framework's built-in optimizer sidestep it entirely.
**Don't use when** — the images are yours and already optimized at build time.
