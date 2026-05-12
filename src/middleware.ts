export { default } from "next-auth/middleware";
export const config = {
  matcher: ["/admin/:path*", "/user/:path*", "/api/users/:path*", "/api/cameras/:path*", "/api/groups/:path*"],
};
