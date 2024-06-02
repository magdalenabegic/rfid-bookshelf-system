import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { db } from "../db";
import { bookLog, books } from "../db/schema";
import { eq } from "drizzle-orm";
import { BookStatus } from "~/utils/constants/book";

export const booksRouter = createTRPCRouter({
  getAll: publicProcedure.query(() => {
    return db.query.books.findMany({
      with: {
        location: {
          columns: {
            name: true,
          },
        },
      },
    });
  }),

  getPending: publicProcedure.query(() => {
    return db.query.books.findMany({
      where: (fields, op) => op.eq(fields.bookStatus, BookStatus.Pending),
    });
  }),

  getOne: publicProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .query(({ input }) => {
      return db.query.books.findFirst({
        where: (fields, op) => op.eq(fields.id, input.id),
      });
    }),

  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.nativeEnum(BookStatus),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, status } = input;

      return db.transaction(async (tx) => {
        const book = await db
          .select({
            id: books.id,
          })
          .from(books)
          .where(eq(books.id, id))
          .limit(1)
          .get();

        if (!book) {
          return {
            success: false as const,
            message: "Book not found",
          };
        }

        await tx.insert(bookLog).values({
          bookId: book.id,
          bookStatus: status,
        });

        const res = await tx
          .update(books)
          .set({
            bookStatus: status,
          })
          .where(eq(books.id, id))
          .returning();

        const newBook = res.at(0);

        if (!newBook) {
          return {
            success: false as const,
            message: "Book not found",
          };
        }

        return {
          success: true as const,
          data: book,
        };
      });
    }),

  getByLocation: publicProcedure
    .input(z.object({ locationId: z.number().optional() }))
    .query(({ input }) => {
      return db.query.books.findMany({
        where: (fields, op) => input.locationId ? op.eq(fields.locationId, input.locationId) : undefined,
        with: {
          location: {
            columns: {
              name: true,
            },
          },
        },
      });
    }),
});
