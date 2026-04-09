export interface TextHttpResponse {
  getContentText(): string;
  getResponseCode(): number;
}

export function createTextHttpResponse(
  body: string,
  responseCode = 200,
): TextHttpResponse {
  return {
    getContentText() {
      return String(body || "");
    },
    getResponseCode() {
      return responseCode;
    },
  };
}
