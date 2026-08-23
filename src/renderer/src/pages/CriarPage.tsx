import { IdeateTool } from './criar/IdeateTool';

export function CriarPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Criar</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Gere ideias de vídeo a partir do seu nicho e dos dados do seu canal. Promova as melhores a
          cards no Kanban — é lá que o SEO, o gancho e o roteiro entram, por conteúdo.
        </p>
      </header>

      <IdeateTool />
    </div>
  );
}
