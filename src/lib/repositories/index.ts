export { areaRepository } from './area';
export type { CreateAreaInput, AreaWithDisciplinas } from './area';

export { disciplinaRepository } from './disciplina';
export type { CreateDisciplinaInput, DisciplinaWithTopicos } from './disciplina';

export { topicoRepository } from './topico';
export type { CreateTopicoInput } from './topico';

export { regraRepository } from './regra';
export type { CreateRegraInput, UpdateRegraInput, ListRegrasOptions } from './regra';

export { cadernoRepository } from './caderno';
export type { CreateCadernoInput, UpdateCadernoInput, CadernoWithRegras } from './caderno';

export { conhecimentoRepository } from './conhecimento';
export type {
  CreateConhecimentoInput,
  UpdateConhecimentoInput,
  ConhecimentoWithCount,
  ConhecimentoWithRegras,
} from './conhecimento';
