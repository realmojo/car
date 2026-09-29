import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

export default nextConfig;

// `next dev` 에서도 Cloudflare 바인딩(.dev.vars 포함)을 사용할 수 있게 한다.
initOpenNextCloudflareForDev();
