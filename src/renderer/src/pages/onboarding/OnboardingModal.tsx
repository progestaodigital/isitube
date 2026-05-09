import { useEffect, useState } from 'react';
import { Settings, Tv, Search, Sparkles } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useRouterStore, type View } from '../../stores/router';

const ONBOARDING_KEY = 'app.onboarding_completed_at';

interface OnboardingModalProps {
  ready: boolean;
}

/**
 * First-launch onboarding. Detects via the `app.onboarding_completed_at`
 * setting — if missing, shows the modal once. User can click any of the 3
 * shortcuts (which both navigate and dismiss) or "Pular por agora".
 */
export function OnboardingModal({ ready }: OnboardingModalProps) {
  const [open, setOpen] = useState(false);
  const navigate = useRouterStore((s) => s.navigate);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    window.api.settings.get(ONBOARDING_KEY).then((value) => {
      if (!cancelled && !value) setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  async function dismiss(target?: View) {
    await window.api.settings.set(ONBOARDING_KEY, new Date().toISOString());
    setOpen(false);
    if (target) navigate(target);
  }

  return (
    <Modal
      open={open}
      onClose={() => dismiss()}
      closeOnBackdrop={false}
      size="lg"
      title="Bem-vindo ao isiTube 👋"
      description="Vamos te ajudar a começar. Escolha por onde quer arrancar — você pode voltar e fazer os outros depois."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ShortcutCard
          icon={Settings}
          tint="bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
          title="Configurar chaves"
          description="Conecte Anthropic, YouTube e Keywords Everywhere. Tudo criptografado neste computador."
          onClick={() => dismiss('settings')}
        />
        <ShortcutCard
          icon={Tv}
          tint="bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
          title="Cadastrar canal"
          description="Adicione canais para monitorar performance e detectar vídeos em destaque."
          onClick={() => dismiss('channels')}
        />
        <ShortcutCard
          icon={Search}
          tint="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
          title="Pesquisar palavra-chave"
          description="Score 0-100 com volume real, concorrência, frescor e tendência."
          onClick={() => dismiss('keywords')}
        />
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-800/50">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <span className="text-zinc-700 dark:text-zinc-300">
            Dica: a Home tem o resumo do seu monitoramento e atalhos rápidos.
          </span>
        </div>
        <Button onClick={() => dismiss()} variant="ghost" size="sm">
          Pular por agora
        </Button>
      </div>
    </Modal>
  );
}

function ShortcutCard({
  icon: Icon,
  tint,
  title,
  description,
  onClick,
}: {
  icon: typeof Settings;
  tint: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-full flex-col items-start gap-3 rounded-xl border border-zinc-200 p-4 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/40"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tint}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>
    </button>
  );
}
