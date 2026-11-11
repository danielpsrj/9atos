import { PrismaClient } from '@prisma/client';

// Plan §2.4 / task 1.3: idempotent seed. Every row uses a deterministic id so
// `upsert` is a no-op on re-run (no duplicates). The bootstrap user is upserted
// by its natural `email` key (AD-01 — single V1 user, no auth).
const prisma = new PrismaClient();

// AD-10 defaults (spec §3.1 ConfiguracaoUsuario).
const configDefaults = {
  modoOfensiva: 'regras' as const,
  limiarOfensiva: 1,
  metaDiaria: 30,
  segundosPorCartao: 30,
  zenModePadrao: true,
  limiteSessao: 20,
};

// Sample hierarchy — Brazilian Constitution, Fundamental Rights (spec §5.2 mockup).
// probabilidade is deliberately varied (0.2–1.0) to exercise AD-11 weighted sampling.
const seed = {
  // The unity of knowledge (issue #62) that groups the sample content. Each
  // multi-content import creates one Conhecimento; the seed creates one so the
  // deployment represents the Knowledge → Notebook structure.
  conhecimento: {
    id: 'conhec-cf-direitos-fundamentais',
    nome: 'Constituição Federal — Direitos Fundamentais',
    descricao: 'Regras de exemplo sobre os direitos e garantias fundamentais (CF/88).',
  },
  area: { id: 'area-direito-constitucional', nome: 'Direito Constitucional' },
  disciplinas: [
    {
      id: 'disc-direitos-fundamentais',
      nome: 'Direitos e Garantias Fundamentais',
      iconeUrl: 'scale',
      corHex: '#3B82F6',
    },
    {
      id: 'disc-garantias-constitucionais',
      nome: 'Garantias Constitucionais',
      iconeUrl: 'shield',
      corHex: '#8B5CF6',
    },
  ],
  topicos: [
    {
      id: 'top-principios-basicos',
      nome: 'Princípios Básicos (Art. 1º)',
      disciplinaId: 'disc-direitos-fundamentais',
    },
    {
      id: 'top-direitos-sociais',
      nome: 'Direitos Sociais (Art. 6º–11)',
      disciplinaId: 'disc-direitos-fundamentais',
    },
    {
      id: 'top-habeas-corpus',
      nome: 'Habeas Corpus e Garantias',
      disciplinaId: 'disc-garantias-constitucionais',
    },
  ],
  regras: [
    {
      id: 'regra-01',
      topicoId: 'top-principios-basicos',
      pergunta:
        'Quais são os fundamentos da República Federativa do Brasil segundo o Art. 1º, caput?',
      respostaCerta:
        'Soberania, cidadania, dignidade da pessoa humana, pluralismo político e valores sociais do trabalho e da livre iniciativa',
      justificativa: 'Art. 1º, caput, CF/88 enumera os cinco fundamentos da República.',
      dica: 'São cinco fundamentos — lembre "Soberania, Cidadania, Dignidade, Pluralismo, Valores sociais".',
      distratores: [
        'Soberania, unidade, indissolubilidade, federalismo e separação de poderes',
        'Cidadania, democracia, livre iniciativa, propriedade privada e igualdade',
        'Soberania, cidadania, dignidade, federalismo e laicidade do Estado',
      ],
      nivelDificuldade: 1,
      probabilidade: 1.0,
    },
    {
      id: 'regra-02',
      topicoId: 'top-principios-basicos',
      pergunta: 'O Art. 1º, §1º, da CF/88 estabelece que todo poder emana de quem?',
      respostaCerta: 'Do povo, que o exerce por meio de representantes eleitos ou diretamente',
      justificativa:
        'Art. 1º, §1º: "Todo o poder emana do povo, que o exerce por meio de representantes eleitos ou diretamente".',
      dica: 'Poder emana do povo — representativo ou direto.',
      distratores: [
        'Do Presidente da República, como chefe de Estado e de Governo',
        'Dos três Poderes, em equilíbrio entre si',
        'Da União, dos Estados e dos Municípios, em conjunto',
      ],
      nivelDificuldade: 1,
      probabilidade: 0.9,
    },
    {
      id: 'regra-03',
      topicoId: 'top-principios-basicos',
      pergunta: 'Qual objetivo fundamental da República NÃO está previsto no Art. 3º da CF/88?',
      respostaCerta: 'Garantir a propriedade privada como fim em si mesma',
      justificativa:
        'O Art. 3º lista erradicar a pobreza, reduzir desigualdades, promover o bem de todos e eliminar discriminações — não a propriedade como fim.',
      dica: 'Os objetivos do Art. 3º são sociais: erradicar pobreza, reduzir desigualdades, promover o bem de todos, eliminar discriminações.',
      distratores: [
        'Erradicar a pobreza e a marginalização e reduzir as desigualdades sociais e regionais',
        'Promover o bem de todos, sem preconceitos de origem, raça, sexo, cor, idade e quaisquer outras formas de discriminação',
        'Assegurar o desenvolvimento nacional e a livre concorrência de mercado',
      ],
      nivelDificuldade: 2,
      probabilidade: 0.7,
    },
    {
      id: 'regra-04',
      topicoId: 'top-principios-basicos',
      pergunta: 'A CF/88 adota o federalismo. Quantas entidades federativas a compõem?',
      respostaCerta: 'Quatro: União, Estados, Municípios e o Distrito Federal',
      justificativa:
        'Art. 18: a organização político-administrativa compreende a União, os Estados, os Municípios e o Distrito Federal.',
      dica: 'União, Estados, Municípios e DF — quatro entes.',
      distratores: [
        'Três: União, Estados e Municípios',
        'Cinco: União, Estados, Municípios, DF e Territórios',
        'Duas: União e Estados, com Municípios como delegações',
      ],
      nivelDificuldade: 1,
      probabilidade: 0.8,
    },
    {
      id: 'regra-05',
      topicoId: 'top-principios-basicos',
      pergunta: 'Segundo o Art. 4º, qual princípio orienta as relações internacionais do Brasil?',
      respostaCerta: 'Prevalência dos direitos humanos',
      justificativa:
        'Art. 4º, i: o Brasil orienta suas relações internacionais pela prevalência dos direitos humanos.',
      dica: 'Entre os princípios do Art. 4º está a prevalência dos direitos humanos.',
      distratores: [
        'Não-intervenção e igualdade soberana apenas, sem menção a direitos humanos',
        'Supremacia do direito internacional sobre a Constituição',
        'Neutralidade permanente em conflitos armados',
      ],
      nivelDificuldade: 2,
      probabilidade: 0.6,
    },
    {
      id: 'regra-06',
      topicoId: 'top-direitos-sociais',
      pergunta: 'O Art. 6º da CF/88 lista direitos sociais. Qual deles NÃO aparece no caput?',
      respostaCerta: 'Direito à propriedade privada',
      justificativa:
        'O caput do Art. 6º lista educação, saúde, alimentação, trabalho, moradia, transporte, lazer, segurança, previdência, proteção à maternidade e à infância, e assistência aos desamparados — não a propriedade.',
      dica: 'Educação, saúde, alimentação, trabalho, moradia, transporte, lazer, segurança, previdência, proteção à maternidade/infância, assistência aos desamparados.',
      distratores: [
        'Educação, saúde, alimentação, trabalho, moradia, transporte, lazer, segurança, previdência social, proteção à maternidade e à infância, assistência aos desamparados',
        'Liberdade de expressão, reunião e associação',
        'Direito de petição, habeas corpus e mandado de segurança',
      ],
      nivelDificuldade: 2,
      probabilidade: 0.75,
    },
    {
      id: 'regra-07',
      topicoId: 'top-direitos-sociais',
      pergunta: 'Quem tem direito à saúde, segundo o Art. 6º, da CF/88?',
      respostaCerta:
        'Todos, mediante política econômica e social que a garanta universal e igualitária',
      justificativa:
        'Art. 6º: "São direitos sociais a educação, a saúde, a alimentação...", garantidos a todos mediante política que assegure acesso universal e igualitário.',
      dica: 'Saúde é direito de todos, dever do Estado.',
      distratores: [
        'Apenas os contribuintes do sistema de saúde',
        'Apenas os segurados do INSS',
        'Apenas os cidadãos brasileiros natos',
      ],
      nivelDificuldade: 1,
      probabilidade: 0.85,
    },
    {
      id: 'regra-08',
      topicoId: 'top-direitos-sociais',
      pergunta:
        'O Art. 7º garante ao trabalhador a proteção contra dispensa arbitrária. Qual é o mecanismo previsto?',
      respostaCerta: 'Indenização compensatória em caso de dispensa arbitrária',
      justificativa:
        'Art. 7º, I: proteção contra a dispensa arbitrária ou sem justa causa, mediante indenização compensatória.',
      dica: 'Dispensa arbitrária gera indenização compensatória.',
      distratores: [
        'Estabilidade vitalícia após cinco anos de serviço',
        'Apenas aviso prévio proporcional, sem indenização',
        'Veto judicial a qualquer demissão no setor privado',
      ],
      nivelDificuldade: 3,
      probabilidade: 0.5,
    },
    {
      id: 'regra-09',
      topicoId: 'top-direitos-sociais',
      pergunta: 'Qual o piso salarial previsto no Art. 7º, VI, da CF/88?',
      respostaCerta:
        'O piso salarial mínimo, fixado em lei, não pode ser inferior ao necessário para o trabalhador e sua família',
      justificativa:
        'Art. 7º, VI: piso salarial fixado em lei, nunca inferior ao necessário para o trabalhador e sua família, com reajustes que preservem seu poder aquisitivo.',
      dica: 'Piso salarial em lei, com poder de compra preservado.',
      distratores: [
        'Um salário mínimo definido pelo Poder Judiciário',
        'O salário médio da categoria profissional',
        'Um valor fixo em reais, imutável',
      ],
      nivelDificuldade: 3,
      probabilidade: 0.4,
    },
    {
      id: 'regra-10',
      topicoId: 'top-direitos-sociais',
      pergunta: 'O Art. 8º da CF/88 trata da previdência social. Qual é a fonte de custeio?',
      respostaCerta:
        'A contribuição dos trabalhadores, dos empregadores e, sobre a renda, dos beneficiários',
      justificativa:
        'Art. 8º: a previdência social é custeada pelos trabalhadores, empregadores e, sobre a renda, pelos beneficiários.',
      dica: 'Custeio tripartite: trabalhadores, empregadores e beneficiários.',
      distratores: [
        'Exclusivamente pelo Tesouro Nacional',
        'Apenas pelas contribuições dos empregadores',
        'Por impostos gerais, sem contribuição específica',
      ],
      nivelDificuldade: 3,
      probabilidade: 0.35,
    },
    {
      id: 'regra-11',
      topicoId: 'top-habeas-corpus',
      pergunta: 'O habeas corpus, previsto no Art. 5º, LXVIII, da CF/88, protege qual direito?',
      respostaCerta: 'A liberdade de locomoção, quando ameaçada por ilegalidade ou abuso de poder',
      justificativa:
        'Art. 5º, LXVIII: cabe habeas corpus para proteger a liberdade de locomoção, quando ameaçada por ilegalidade ou abuso de poder.',
      dica: 'Habeas corpus protege a liberdade de ir e vir.',
      distratores: [
        'O direito de propriedade contra desapropriação',
        'O direito de reunião e associação',
        'O direito ao silêncio em interrogatório',
      ],
      nivelDificuldade: 2,
      probabilidade: 0.9,
    },
    {
      id: 'regra-12',
      topicoId: 'top-habeas-corpus',
      pergunta: 'Segundo o Art. 5º, LIV, da CF/88, ninguém será punido sem o quê?',
      respostaCerta: 'Sem processo legal',
      justificativa:
        'Art. 5º, LIV: "ninguém será privado da liberdade ou de seus bens sem o devido processo legal".',
      dica: 'Devido processo legal é condição para privação de liberdade ou bens.',
      distratores: [
        'Sem sentença de um tribunal superior',
        'Sem anuência do Ministério Público',
        'Sem audiência pública',
      ],
      nivelDificuldade: 1,
      probabilidade: 0.95,
    },
    {
      id: 'regra-13',
      topicoId: 'top-habeas-corpus',
      pergunta:
        'O Art. 5º, LXXII, da CF/88 prevê o mandado de segurança. Contra quem pode ser impetrado?',
      respostaCerta:
        'Contra ato de autoridade federal, estadual ou municipal, que viole direito líquido e certo',
      justificativa:
        'Art. 5º, LXXII: o mandado de segurança protege direito líquido e certo, não subordinado a habeas corpus, violado por autoridade pública.',
      dica: 'Mandado de segurança é contra ato de autoridade que viole direito líquido e certo.',
      distratores: [
        'Apenas contra atos do Poder Judiciário',
        'Apenas contra atos do Presidente da República',
        'Contra qualquer particular, em qualquer situação',
      ],
      nivelDificuldade: 3,
      probabilidade: 0.55,
    },
    {
      id: 'regra-14',
      topicoId: 'top-habeas-corpus',
      pergunta: 'O Art. 5º, XLIV, da CF/88, garante a inviolabilidade de quê?',
      respostaCerta: 'Da intimidade, da vida privada, da honra e da imagem das pessoas',
      justificativa:
        'Art. 5º, XLIV: são invioláveis a intimidade, a vida privada, a honra e a imagem das pessoas, incluídos os dados pessoais.',
      dica: 'Intimidade, vida privada, honra e imagem são invioláveis.',
      distratores: [
        'Apenas a correspondência e os papéis privados',
        'Apenas o domicílio, durante a noite',
        'Apenas os segredos comerciais',
      ],
      nivelDificuldade: 2,
      probabilidade: 0.65,
    },
    {
      id: 'regra-15',
      topicoId: 'top-habeas-corpus',
      pergunta:
        'Segundo o Art. 5º, II, da CF/88, ninguém será obrigado a fazer ou deixar de fazer alguma coisa em razão do quê?',
      respostaCerta: 'Da lei',
      justificativa:
        'Art. 5º, II: "ninguém será obrigado a fazer ou deixar de fazer alguma coisa senão em virtude de lei".',
      dica: 'Obrigação só em virtude de lei — princípio da legalidade.',
      distratores: [
        'Da ordem de um superior hierárquico',
        'Da convenção coletiva da categoria',
        'Da decisão administrativa discricionária',
      ],
      nivelDificuldade: 1,
      probabilidade: 0.8,
    },
  ],
};

async function main() {
  // 1. Bootstrap user (AD-01) + default config (AD-10). Upsert by email.
  const usuario = await prisma.usuario.upsert({
    where: { email: 'bootstrap@9atos.local' },
    update: {},
    create: {
      id: 'usuario-bootstrap',
      nome: 'Estudante',
      email: 'bootstrap@9atos.local',
      configuracao: { create: configDefaults },
    },
  });

  // 2. Knowledge (unity of knowledge, issue #62) + Area.
  await prisma.conhecimento.upsert({
    where: { id: seed.conhecimento.id },
    update: { nome: seed.conhecimento.nome, descricao: seed.conhecimento.descricao },
    create: seed.conhecimento,
  });
  await prisma.area.upsert({
    where: { id: seed.area.id },
    update: { nome: seed.area.nome },
    create: seed.area,
  });

  // 3. Disciplinas.
  for (const d of seed.disciplinas) {
    await prisma.disciplina.upsert({
      where: { id: d.id },
      update: { nome: d.nome, iconeUrl: d.iconeUrl, corHex: d.corHex, areaId: seed.area.id },
      create: { ...d, areaId: seed.area.id },
    });
  }

  // 4. Topicos.
  for (const t of seed.topicos) {
    await prisma.topico.upsert({
      where: { id: t.id },
      update: { nome: t.nome, disciplinaId: t.disciplinaId },
      create: t,
    });
  }

  // 5. Regras (≥15, varied probabilidade, ≥3 distratores each). Each belongs to
  // the sample Knowledge (issue #62).
  for (const r of seed.regras) {
    await prisma.regra.upsert({
      where: { id: r.id },
      update: {
        pergunta: r.pergunta,
        respostaCerta: r.respostaCerta,
        justificativa: r.justificativa,
        dica: r.dica,
        distratores: r.distratores,
        nivelDificuldade: r.nivelDificuldade,
        probabilidade: r.probabilidade,
        topicoId: r.topicoId,
        conhecimentoId: seed.conhecimento.id,
      },
      create: {
        id: r.id,
        topicoId: r.topicoId,
        conhecimentoId: seed.conhecimento.id,
        pergunta: r.pergunta,
        respostaCerta: r.respostaCerta,
        justificativa: r.justificativa,
        dica: r.dica,
        distratores: r.distratores,
        nivelDificuldade: r.nivelDificuldade,
        probabilidade: r.probabilidade,
      },
    });
  }

  // Summary.
  const [conhecimentos, areas, disciplinas, topicos, regras, usuarios] = await Promise.all([
    prisma.conhecimento.count(),
    prisma.area.count(),
    prisma.disciplina.count(),
    prisma.topico.count(),
    prisma.regra.count(),
    prisma.usuario.count(),
  ]);
  console.log(
    `Seed complete: ${String(usuarios)} usuario(s), ${String(conhecimentos)} conhecimento(s), ${String(areas)} area(s), ${String(disciplinas)} disciplina(s), ${String(topicos)} topico(s), ${String(regras)} regra(s).`,
  );
  console.log(`Bootstrap user: ${usuario.nome} <${usuario.email ?? 'sem e-mail'}>`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
