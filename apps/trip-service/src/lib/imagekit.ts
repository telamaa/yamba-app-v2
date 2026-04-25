import ImageKit from "imagekit";

if (!process.env.IMAGEKIT_PUBLIC_KEY) {
  console.warn("[ImageKit] IMAGEKIT_PUBLIC_KEY is not set");
}
if (!process.env.IMAGEKIT_PRIVATE_KEY) {
  console.warn("[ImageKit] IMAGEKIT_PRIVATE_KEY is not set");
}
if (!process.env.IMAGEKIT_URL_ENDPOINT) {
  console.warn("[ImageKit] IMAGEKIT_URL_ENDPOINT is not set");
}

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY ?? "",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY ?? "",
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT ?? "",
});

export default imagekit;
