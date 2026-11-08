// Developer panel (switch accounts, see sent SMS/email). Only for local testing: it lets anyone log in as
// anyone, so it needs DEV_TOOLS=1 AND a non-https SITE_URL. A live site refuses to start with DEV_TOOLS=1.
export const devToolsEnabled = () => process.env.DEV_TOOLS === "1" && !(process.env.SITE_URL ?? "").startsWith("https://");
