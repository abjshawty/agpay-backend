export const swaggerConfig: any = {
  info: {
    title: "Test swagger",
    description: "Testing the Fastify swagger API",
    version: "0.1.0",
  },
  externalDocs: {
    url: "https://swagger.io",
    description: "Find more info here",
  },
  host: "localhost:8080",
  schemes: ["http"],
  consumes: ["application/json"],
  produces: ["application/json"],
  tags: [
    { name: "User", description: "User related end-points" },
    { name: "Keycloak", description: "Keycloak related end-points" },
    { name: "Partners", description: "Partner related end-points" },
    { name: "Accounts", description: "Account related end-points" },
    { name: "Banks", description: "Bank related end-points" },
    { name: "Files", description: "File related end-points" },
    { name: "Profils", description: "Profile related end-points" },
    { name: "Societies", description: "Society related end-points" },
    { name: "Test", description: "Test related end-points" },
    { name: "Config", description: "config related end-points" },
  ],
  definitions: {},
  securityDefinitions: {
    apiKey: {
      type: "apiKey",
      name: "apiKey",
      in: "header",
    },
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    },
  },
  security: [{ bearerAuth: [] }],
};
export const swaggerUiConfig: any = {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "none",
    deepLinking: false,
    persistAuthorization: true,
  },
  uiHooks: {
    onRequest: function (request, reply, next) {
      next();
    },
    preHandler: function (request, reply, next) {
      next();
    },
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  transformSpecification: (swaggerObject, request, reply) => {
    return swaggerObject;
  },
  transformSpecificationClone: true,
};
