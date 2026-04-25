import swaggerAutogen from "swagger-autogen";

const doc = {
  info: {
    title: "Yamba-app : Trip Service API",
    description: "Automatically generated Swagger docs",
    version: "1.0.0",
  },
  host: "localhost:6002", // adapte le port
  schemes: ["http"],
};

const outputFile = "./swagger-output.json";
const endpointsFiles = ["./routes/trip.router.ts"]; // adapte au nom de ton fichier de routes

swaggerAutogen()(outputFile, endpointsFiles, doc);
