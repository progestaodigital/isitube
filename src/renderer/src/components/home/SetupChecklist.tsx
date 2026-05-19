// Checklist de setup visível na Home enquanto o usuário Pro ainda não
// configurou as chaves obrigatórias (Anthropic + YouTube Data API).
// Some sozinho assim que as duas viram 'valid'. KE é opcional — não
// trava o setup mas aparece como item adicional sugerido.
//
// Iniciante NÃO vê esse card (proxy do isipanel fornece tudo). Apenas Pro.
//
// Click em "Configurar" leva pra Settings + aponta o wiki interno pro
// tópico de tutorial daquele provider (deep-link).

import { CheckCircle2, Circle, ChevronRight, Sparkles } from 'lucide-react';
import { Card } from '../ui/Card';
import { useRouterStore } from '../../stores/router';
import { useHelpStore, type HelpTopic } from '../../stores/help';
import { useLicense } from '../../hooks/useLicense';
import { isCredentialReady, useCredentialStatus } from '../../hooks/useCredentialStatus';
import { cn } from '../../lib/cn';

export function SetupChecklist() {
  const { info } = useLicense();
  const navigate = useRouterStore((s) => s.navigate);
  const setHelpTopic = useHelpStore((s) => s.setTopic);
  const anthropic = useCredentialStatus('anthropic');
  const youtube = useCredentialStatus('youtube');
  const ke = useCredentialStatus('keywords_everywhere');

  // Não exibe pra Iniciante (proxy do isipanel fornece tudo) nem pra estado
  // de loading. Só Pro com pelo menos uma das 2 obrigatórias faltando.
  if (!info || info.plan !== 'pro') return null;

  const anthropicReady = isCredentialReady(anthropic);
  const youtubeReady = isCredentialReady(youtube);
  const keReady = isCredentialReady(ke);

  const requiredDone = anthropicReady && youtubeReady;
  if (requiredDone) return null;

  const total = 3; // licença + anthropic + youtube
  const done = 1 + (anthropicReady ? 1 : 0) + (youtubeReady ? 1 : 0);

  function goConfigure(topic: HelpTopic) {
    setHelpTopic(topic);
    navigate('settings');
  }

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-amber-900 dark:text-amber-100">
              Configure suas chaves
            </h2>
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-900 dark:bg-amber-800 dark:text-amber-100">
              {done} de {total}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-100/80">
            Você está no plano Pro — precisa cadastrar suas próprias chaves
            de IA e YouTube pra começar.{' '}
            <button
              onClick={() => {
                setHelpTopic('plans');
                navigate('help');
              }}
              className="font-medium underline-offset-2 hover:underline"
            >
              Por que tem que cadastrar?
            </button>
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        <Item done label="Licença ativa" description="Sua chave isiTube foi validada." />
        <Item
          done={anthropicReady}
          label="Anthropic Claude"
          description="IA pra gerar ideias e analisar oportunidades."
          onConfigure={!anthropicReady ? () => goConfigure('api-anthropic') : undefined}
        />
        <Item
          done={youtubeReady}
          label="YouTube Data API"
          description="Pra cadastrar canais, atualizar métricas e extrair metadata."
          onConfigure={!youtubeReady ? () => goConfigure('api-youtube') : undefined}
        />
        <Item
          done={keReady}
          label="Keywords Everywhere"
          description="Volume mensal real nas buscas. Opcional — o score se renormaliza sem ela."
          optional
          onConfigure={!keReady ? () => goConfigure('api-ke') : undefined}
        />
      </ul>
    </Card>
  );
}

interface ItemProps {
  done: boolean;
  label: string;
  description: string;
  optional?: boolean;
  onConfigure?: () => void;
}

function Item({ done, label, description, optional, onConfigure }: ItemProps) {
  const Icon = done ? CheckCircle2 : Circle;
  return (
    <li className="flex items-start gap-3">
      <Icon
        className={cn(
          'mt-0.5 h-5 w-5 shrink-0',
          done
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-amber-700 dark:text-amber-400'
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'text-sm font-medium',
              done
                ? 'text-emerald-900 dark:text-emerald-200'
                : 'text-amber-900 dark:text-amber-100'
            )}
          >
            {label}
          </p>
          {optional && !done && (
            <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              Opcional
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-amber-900/70 dark:text-amber-100/70">
          {description}
        </p>
      </div>
      {onConfigure && (
        <button
          onClick={onConfigure}
          className="inline-flex shrink-0 items-center gap-0.5 self-center rounded-full bg-amber-700 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-800"
        >
          Configurar
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </li>
  );
}
