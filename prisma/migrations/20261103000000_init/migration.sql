-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ModoOfensiva" AS ENUM ('sessoes', 'regras');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "ofensivaAtual" INTEGER NOT NULL DEFAULT 0,
    "maiorOfensiva" INTEGER NOT NULL DEFAULT 0,
    "ultimoAcesso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disciplina" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "iconeUrl" TEXT,
    "corHex" TEXT,
    "areaId" TEXT NOT NULL,

    CONSTRAINT "Disciplina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topico" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "disciplinaId" TEXT NOT NULL,

    CONSTRAINT "Topico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Regra" (
    "id" TEXT NOT NULL,
    "topicoId" TEXT NOT NULL,
    "pergunta" TEXT NOT NULL,
    "respostaCerta" TEXT NOT NULL,
    "justificativa" TEXT,
    "dica" TEXT,
    "distratores" JSONB NOT NULL DEFAULT '[]',
    "nivelDificuldade" INTEGER NOT NULL DEFAULT 1,
    "probabilidade" DOUBLE PRECISION,

    CONSTRAINT "Regra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caderno" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "Caderno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegraNoCaderno" (
    "cadernoId" TEXT NOT NULL,
    "regraId" TEXT NOT NULL,

    CONSTRAINT "RegraNoCaderno_pkey" PRIMARY KEY ("cadernoId","regraId")
);

-- CreateTable
CREATE TABLE "ProgressoUsuario" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "regraId" TEXT NOT NULL,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervaloDias" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proximaRevisao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "historico" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ProgressoUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoUsuario" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "modoOfensiva" "ModoOfensiva" NOT NULL DEFAULT 'regras',
    "limiarOfensiva" INTEGER NOT NULL DEFAULT 1,
    "metaDiaria" INTEGER NOT NULL DEFAULT 30,
    "segundosPorCartao" INTEGER NOT NULL DEFAULT 30,
    "zenModePadrao" BOOLEAN NOT NULL DEFAULT true,
    "limiteSessao" INTEGER NOT NULL DEFAULT 20,

    CONSTRAINT "ConfiguracaoUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressoUsuario_usuarioId_regraId_key" ON "ProgressoUsuario"("usuarioId", "regraId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoUsuario_usuarioId_key" ON "ConfiguracaoUsuario"("usuarioId");

-- AddForeignKey
ALTER TABLE "Disciplina" ADD CONSTRAINT "Disciplina_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topico" ADD CONSTRAINT "Topico_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "Disciplina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Regra" ADD CONSTRAINT "Regra_topicoId_fkey" FOREIGN KEY ("topicoId") REFERENCES "Topico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caderno" ADD CONSTRAINT "Caderno_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegraNoCaderno" ADD CONSTRAINT "RegraNoCaderno_cadernoId_fkey" FOREIGN KEY ("cadernoId") REFERENCES "Caderno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegraNoCaderno" ADD CONSTRAINT "RegraNoCaderno_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "Regra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressoUsuario" ADD CONSTRAINT "ProgressoUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressoUsuario" ADD CONSTRAINT "ProgressoUsuario_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "Regra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfiguracaoUsuario" ADD CONSTRAINT "ConfiguracaoUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

