// Keep links to the original misspelled beta hostname usable.
export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);
    url.protocol = "https:";
    url.hostname = "eonmun-beta.ncrmro.workers.dev";
    url.port = "";
    return Response.redirect(url.toString(), 308);
  },
};
