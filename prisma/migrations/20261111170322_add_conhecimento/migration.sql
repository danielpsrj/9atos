-- AlterTable
ALTER TABLE "Caderno" ADD COLUMN     "conhecimentoId" TEXT;

-- AlterTable
ALTER TABLE "Regra" ADD COLUMN     "conhecimentoId" TEXT;

-- CreateTable
CREATE TABLE "Conhecimento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conhecimento_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Regra" ADD CONSTRAINT "Regra_conhecimentoId_fkey" FOREIGN KEY ("conhecimentoId") REFERENCES "Conhecimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caderno" ADD CONSTRAINT "Caderno_conhecimentoId_fkey" FOREIGN KEY ("conhecimentoId") REFERENCES "Conhecimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
