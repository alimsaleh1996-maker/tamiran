declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    TAMIRAN_DATA_KEY?: string;
    BUCKET?: R2Bucket;
  }
}
