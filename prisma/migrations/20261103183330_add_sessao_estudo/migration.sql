-- CreateTable
CREATE TABLE "SessaoEstudo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "resultados" JSONB NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessaoEstudo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessaoEstudo_usuarioId_id_key" ON "SessaoEstudo"("usuarioId", "id");

-- AddForeignKey
ALTER TABLE "SessaoEstudo" ADD CONSTRAINT "SessaoEstudo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
