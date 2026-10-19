import type { FastifyInstance, FastifyReply } from "fastify";
import { ErrorResponse, Menu, MenuIdParams, MenuInput } from "@home-rpi/contracts";
import { Type } from "typebox";
import type { MenusService } from "./menus.service.ts";

const tags = ["menus"];

function notFound(reply: FastifyReply) {
  return reply.code(404).send({ statusCode: 404, error: "Not Found", message: "Menú no encontrado" });
}

/** Capa HTTP de menús: schemas (runtime + OpenAPI), códigos de estado y delegación en el servicio. */
export function registerMenusRoutes(app: FastifyInstance, service: MenusService): void {
  app.get(
    "/api/menus",
    {
      schema: {
        tags,
        summary: "Listar menús",
        response: { 200: Type.Array(Menu), 500: ErrorResponse },
      },
    },
    async () => service.list(),
  );

  app.get(
    "/api/menus/:id",
    {
      schema: {
        tags,
        summary: "Obtener un menú por ID",
        params: MenuIdParams,
        response: { 200: Menu, 404: ErrorResponse, 500: ErrorResponse },
      },
    },
    async (request, reply) => {
      const menu = await service.get((request.params as MenuIdParams).id);
      return menu ?? notFound(reply);
    },
  );

  app.post(
    "/api/menus",
    {
      schema: {
        tags,
        summary: "Crear un menú (el ID lo genera el backend)",
        body: MenuInput,
        response: { 201: Menu, 400: ErrorResponse, 500: ErrorResponse },
      },
    },
    async (request, reply) => reply.code(201).send(await service.create(request.body as MenuInput)),
  );

  app.put(
    "/api/menus/:id",
    {
      schema: {
        tags,
        summary: "Reemplazar commerce y products de un menú existente",
        params: MenuIdParams,
        body: MenuInput,
        response: { 200: Menu, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse },
      },
    },
    async (request, reply) => {
      const menu = await service.update((request.params as MenuIdParams).id, request.body as MenuInput);
      return menu ?? notFound(reply);
    },
  );

  app.delete(
    "/api/menus/:id",
    {
      schema: {
        tags,
        summary: "Eliminar un menú (devuelve el menú eliminado)",
        params: MenuIdParams,
        response: { 200: Menu, 404: ErrorResponse, 500: ErrorResponse },
      },
    },
    async (request, reply) => {
      const menu = await service.delete((request.params as MenuIdParams).id);
      return menu ?? notFound(reply);
    },
  );
}
