import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ImagePlus,
  Wand2,
  Sparkles,
  Download,
  Trash2,
  Loader2,
  Crown,
  Info,
  Search,
  UserPlus,
  Plus,
  X,
  Film,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useToastStore } from '../stores/toast';
import { useRouterStore } from '../stores/router';
import type {
  ImageUpload,
  ThumbnailAsset,
  ThumbnailCharacter,
  ThumbnailGeneration,
  ThumbnailScene,
  ThumbnailStudioStatus,
  VideoThumbnailHit,
} from '@shared/types';

function fileToUpload(file: File): Promise<ImageUpload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve({ base64: result.slice(comma + 1), mimeType: file.type || 'image/png' });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function filesToUploads(files: FileList): Promise<ImageUpload[]> {
  return Promise.all(Array.from(files).map(fileToUpload));
}

function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ThumbnailsPage() {
  const showToast = useToastStore((s) => s.show);
  const navigate = useRouterStore((s) => s.navigate);

  const [status, setStatus] = useState<ThumbnailStudioStatus | null>(null);
  const [characters, setCharacters] = useState<ThumbnailCharacter[]>([]);
  const [scenes, setScenes] = useState<ThumbnailScene[]>([]);
  const [styleAssets, setStyleAssets] = useState<ThumbnailAsset[]>([]);
  const [generations, setGenerations] = useState<ThumbnailGeneration[]>([]);

  const [selectedStyleIds, setSelectedStyleIds] = useState<Set<string>>(new Set());
  const [characterId, setCharacterId] = useState('');
  const [useScene, setUseScene] = useState(false);
  const [sceneId, setSceneId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [buildingPrompt, setBuildingPrompt] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newCharName, setNewCharName] = useState('');
  const [newSceneName, setNewSceneName] = useState('');
  const [usdBrl, setUsdBrl] = useState(5.2);

  const charPhotoInputRef = useRef<HTMLInputElement>(null);
  const sceneInputRef = useRef<HTMLInputElement>(null);
  const pendingCharId = useRef<string | null>(null);
  const pendingSceneName = useRef<string>('');
  const initialized = useRef(false);

  const refreshAll = useCallback(async () => {
    const [st, chars, scns, assets, gens] = await Promise.all([
      window.api.thumbnails.status(),
      window.api.thumbnails.listCharacters(),
      window.api.thumbnails.listScenes(),
      window.api.thumbnails.listAssets('style'),
      window.api.thumbnails.listGenerations(),
    ]);
    setStatus(st);
    setCharacters(chars);
    setScenes(scns);
    setStyleAssets(assets);
    // Referências salvas vêm selecionadas por padrão (salvou = quer usar).
    // Só na 1ª carga — depois respeita a seleção/deseleção do usuário.
    if (!initialized.current) {
      setSelectedStyleIds(new Set(assets.map((a) => a.id)));
      initialized.current = true;
    }
    setGenerations(gens);
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    window.api.thumbnails.usdBrlRate().then(setUsdBrl).catch(() => {});
  }, []);

  const selectedStyleCount = selectedStyleIds.size;
  const selectedStyleAssets = styleAssets.filter((a) => selectedStyleIds.has(a.id));
  const canGenerate = status?.canGenerate ?? false;

  function toggleStyle(id: string) {
    setSelectedStyleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---- Personagens ----
  async function handleCreateCharacter() {
    const name = newCharName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const c = await window.api.thumbnails.createCharacter(name);
      setNewCharName('');
      await refreshAll();
      // Já abre o seletor de fotos pro personagem recém-criado.
      pendingCharId.current = c.id;
      charPhotoInputRef.current?.click();
    } finally {
      setBusy(false);
    }
  }

  function triggerAddPhotos(charId: string) {
    pendingCharId.current = charId;
    charPhotoInputRef.current?.click();
  }

  async function handleCharPhotosSelected(files: FileList | null) {
    const charId = pendingCharId.current;
    if (!files || files.length === 0 || !charId) return;
    setBusy(true);
    try {
      const uploads = await filesToUploads(files);
      await window.api.thumbnails.addCharacterPhotos(charId, uploads);
      await refreshAll();
      showToast({ kind: 'success', title: `${uploads.length} foto(s) adicionada(s)` });
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao adicionar fotos',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
      pendingCharId.current = null;
      if (charPhotoInputRef.current) charPhotoInputRef.current.value = '';
    }
  }

  async function handleRemovePhoto(photoId: string) {
    await window.api.thumbnails.removeCharacterPhoto(photoId);
    await refreshAll();
  }

  async function handleDeleteCharacter(id: string) {
    if (!window.confirm('Apagar este personagem e suas fotos?')) return;
    await window.api.thumbnails.deleteCharacter(id);
    if (characterId === id) setCharacterId('');
    await refreshAll();
  }

  async function handleRenameCharacter(c: ThumbnailCharacter) {
    const name = window.prompt('Nome do personagem:', c.name);
    if (name === null) return;
    await window.api.thumbnails.renameCharacter(c.id, name);
    await refreshAll();
  }

  // ---- Cenários ----
  function triggerCreateScene() {
    const name = newSceneName.trim();
    if (!name) {
      showToast({ kind: 'info', title: 'Dê um nome ao cenário primeiro' });
      return;
    }
    pendingSceneName.current = name;
    sceneInputRef.current?.click();
  }

  async function handleSceneSelected(files: FileList | null) {
    const name = pendingSceneName.current;
    if (!files || files.length === 0 || !name) return;
    setBusy(true);
    try {
      const [upload] = await filesToUploads(files);
      await window.api.thumbnails.createScene(name, upload);
      setNewSceneName('');
      await refreshAll();
      showToast({ kind: 'success', title: 'Cenário criado' });
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao criar cenário',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
      pendingSceneName.current = '';
      if (sceneInputRef.current) sceneInputRef.current.value = '';
    }
  }

  async function handleDeleteScene(id: string) {
    await window.api.thumbnails.deleteScene(id);
    if (sceneId === id) {
      setSceneId('');
      setUseScene(false);
    }
    await refreshAll();
  }

  // ---- Estilo ----
  async function handleAddStyleFromVideo(videoId: string) {
    setBusy(true);
    try {
      const asset = await window.api.thumbnails.addAssetFromVideo(videoId, 'style');
      await refreshAll();
      setSelectedStyleIds((prev) => new Set(prev).add(asset.id));
      showToast({ kind: 'success', title: 'Referência de estilo adicionada' });
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao adicionar referência',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleAutoStyle() {
    setBusy(true);
    try {
      const asset = await window.api.thumbnails.pickAutoStyleRef();
      if (!asset) {
        showToast({
          kind: 'info',
          title: 'Sem vídeo de referência',
          description: 'Nenhum vídeo em destaque com thumbnail. Atualize seus canais primeiro.',
        });
        return;
      }
      await refreshAll();
      setSelectedStyleIds((prev) => new Set(prev).add(asset.id));
      showToast({ kind: 'success', title: 'Referência de estilo escolhida automaticamente' });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteStyle(id: string) {
    await window.api.thumbnails.deleteAsset(id);
    setSelectedStyleIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    await refreshAll();
  }

  // ---- Geração ----
  async function handleBuildPrompt() {
    if (selectedStyleAssets.length === 0) {
      showToast({ kind: 'info', title: 'Selecione uma referência de estilo primeiro' });
      return;
    }
    setBuildingPrompt(true);
    try {
      const detailed = await window.api.thumbnails.buildPrompt(
        selectedStyleAssets[0].id,
        prompt,
        useScene && !!sceneId
      );
      if (detailed?.trim()) {
        setPrompt(detailed.trim());
        showToast({
          kind: 'success',
          title: 'Prompt gerado a partir da referência',
          description: 'Revise/ajuste o texto e clique em Gerar.',
        });
      } else {
        showToast({ kind: 'error', title: 'Não consegui gerar o prompt a partir da referência' });
      }
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao gerar o prompt',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBuildingPrompt(false);
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      showToast({ kind: 'info', title: 'Escreva um prompt' });
      return;
    }
    setGenerating(true);
    try {
      const res = await window.api.thumbnails.generate({
        prompt,
        characterId: characterId || null,
        sceneId: useScene && sceneId ? sceneId : null,
        styleAssetIds: Array.from(selectedStyleIds),
        count,
      });
      if (!res.success) {
        showToast({ kind: 'error', title: 'Não foi possível gerar', description: res.message });
        return;
      }
      await refreshAll();
      showToast({ kind: 'success', title: res.message });
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha na geração',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleExport(id: string) {
    const res = await window.api.thumbnails.export(id);
    if (res.success) showToast({ kind: 'success', title: 'Salvo', description: res.path });
    else if (res.message !== 'Exportação cancelada.')
      showToast({ kind: 'error', title: 'Falha ao salvar', description: res.message });
  }

  async function handleAdjust(genId: string, instruction: string) {
    const res = await window.api.thumbnails.adjust(genId, instruction);
    if (!res.success) {
      showToast({ kind: 'error', title: 'Não foi possível ajustar', description: res.message });
      return;
    }
    await refreshAll();
    showToast({ kind: 'success', title: res.message });
  }

  async function handleDeleteGeneration(id: string) {
    await window.api.thumbnails.deleteGeneration(id);
    await refreshAll();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Thumbnails</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Crie personagens (suas fotos), cenários e referências de estilo. Depois é só selecionar na
          hora de gerar. Tudo fica salvo localmente e entra no backup.
        </p>
      </header>

      <StatusBanner status={status} onConfigure={() => navigate('settings')} />

      {/* Hidden file inputs */}
      <input
        ref={charPhotoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleCharPhotosSelected(e.target.files)}
      />
      <input
        ref={sceneInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleSceneSelected(e.target.files)}
      />

      {/* Personagens */}
      <Card>
        <h2 className="text-lg font-semibold">Personagens</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Um personagem agrupa suas fotos pra a IA aprender sua fisionomia. Recomendado{' '}
          <b>5-10 fotos</b> variadas (ângulos, expressões, luz).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={newCharName}
            onChange={(e) => setNewCharName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateCharacter()}
            placeholder="Nome do personagem (ex: Eu — camisa preta)"
            className="h-9 flex-1 min-w-[220px] rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <Button onClick={handleCreateCharacter} disabled={busy || !newCharName.trim()} variant="primary" size="sm">
            <UserPlus className="h-4 w-4" />
            Criar personagem
          </Button>
        </div>

        {characters.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {characters.map((c) => (
              <CharacterCard
                key={c.id}
                character={c}
                onAddPhotos={() => triggerAddPhotos(c.id)}
                onRemovePhoto={handleRemovePhoto}
                onRename={() => handleRenameCharacter(c)}
                onDelete={() => handleDeleteCharacter(c.id)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Cenários */}
      <Card>
        <h2 className="text-lg font-semibold">Cenários</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Fundos reusáveis — ex: uma foto do set onde você grava. Na geração você escolhe se usa e
          qual.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={newSceneName}
            onChange={(e) => setNewSceneName(e.target.value)}
            placeholder="Nome do cenário (ex: Meu escritório)"
            className="h-9 flex-1 min-w-[220px] rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <Button onClick={triggerCreateScene} disabled={busy || !newSceneName.trim()} variant="primary" size="sm">
            <Plus className="h-4 w-4" />
            Adicionar cenário
          </Button>
        </div>

        {scenes.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {scenes.map((s) => (
              <div
                key={s.id}
                className="group relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
              >
                <img src={s.dataUrl} alt={s.name} className="aspect-video w-full object-cover" />
                <div className="p-2">
                  <p className="line-clamp-1 text-xs font-medium">{s.name}</p>
                </div>
                <button
                  onClick={() => handleDeleteScene(s.id)}
                  title="Apagar cenário"
                  aria-label="Apagar cenário"
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Referências de estilo */}
      <Card>
        <h2 className="text-lg font-semibold">Referências de estilo (opcional)</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Busque um vídeo pelo título e use a thumbnail dele como referência de composição/estilo.
          Ou deixe o sistema escolher a de melhor desempenho.
        </p>
        <div className="mt-3">
          <StyleSearch onAdd={handleAddStyleFromVideo} busy={busy} />
        </div>
        <div className="mt-3">
          <Button onClick={handleAutoStyle} disabled={busy} variant="secondary" size="sm">
            <Sparkles className="h-4 w-4" />
            Escolher automático (maior destaque)
          </Button>
        </div>

        {styleAssets.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-zinc-500">
              Salvas — clique pra usar na geração ({selectedStyleCount} selecionada
              {selectedStyleCount === 1 ? '' : 's'}):
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {styleAssets.map((a) => (
                <div
                  key={a.id}
                  className={`group relative overflow-hidden rounded-xl border transition-colors ${
                    selectedStyleIds.has(a.id)
                      ? 'border-red-400 ring-2 ring-red-500/30 dark:border-red-700'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
                  }`}
                >
                  <button onClick={() => toggleStyle(a.id)} className="block w-full text-left">
                    <img src={a.dataUrl} alt={a.label} className="aspect-video w-full object-cover" />
                    <p className="line-clamp-1 p-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {a.label}
                    </p>
                  </button>
                  <button
                    onClick={() => handleDeleteStyle(a.id)}
                    title="Remover"
                    aria-label="Remover"
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  {selectedStyleIds.has(a.id) && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Usando
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Gerar */}
      <Card>
        <h2 className="text-lg font-semibold">Gerar thumbnail</h2>

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Personagem
            </span>
            <select
              value={characterId}
              onChange={(e) => setCharacterId(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Nenhum</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.photos.length} fotos)
                </option>
              ))}
            </select>
          </label>

          <div className="text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Cenário
            </span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={useScene}
                  onChange={(e) => setUseScene(e.target.checked)}
                  className="h-4 w-4"
                />
                Usar cenário
              </label>
              <select
                value={sceneId}
                disabled={!useScene}
                onChange={(e) => setSceneId(e.target.value)}
                className="h-9 flex-1 rounded-md border border-zinc-300 bg-white px-2 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">Selecione…</option>
                {scenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedStyleCount > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 p-2.5 dark:border-violet-900 dark:bg-violet-950/30">
            <Sparkles className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
            <span className="flex-1 text-xs text-violet-900 dark:text-violet-200">
              Escreva sua alteração no campo abaixo (ex.: texto, expressão, "sem logo") e clique — a
              IA lê a referência e escreve um <b>prompt detalhado</b> no campo. Depois é só revisar e
              gerar.
            </span>
            <Button
              onClick={handleBuildPrompt}
              disabled={buildingPrompt || !canGenerate}
              variant="secondary"
              size="sm"
            >
              {buildingPrompt ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {buildingPrompt ? 'Lendo referência…' : 'Gerar prompt da referência'}
            </Button>
          </div>
        )}

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder={
            'Descreva a thumbnail (ou sua alteração, se for usar "Gerar prompt da referência"). ' +
            'Ex: texto "QUASE ME QUEBROU", expressão preocupada, segurando dinheiro.'
          }
          className="mt-4 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            Variações
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1.5">
            {selectedStyleAssets.slice(0, 3).map((a) => (
              <img key={a.id} src={a.dataUrl} alt="" className="h-6 w-10 rounded object-cover" />
            ))}
            <span className="text-xs text-zinc-500">
              {selectedStyleCount > 0
                ? `${selectedStyleCount} referência(s) de estilo`
                : 'sem referência de estilo'}
            </span>
          </div>
          <div className="ml-auto">
            <Button
              onClick={handleGenerate}
              disabled={generating || !canGenerate || !prompt.trim()}
              variant="primary"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {generating ? 'Gerando…' : 'Gerar thumbnail'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Geradas */}
      <Card>
        <h2 className="text-lg font-semibold">Geradas</h2>
        {generations.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Suas thumbnails geradas aparecem aqui. Ainda não há nenhuma.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {generations.map((g) => (
              <GenerationCard
                key={g.id}
                gen={g}
                usdBrl={usdBrl}
                onExport={() => handleExport(g.id)}
                onDelete={() => handleDeleteGeneration(g.id)}
                onAdjust={handleAdjust}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusBanner({
  status,
  onConfigure,
}: {
  status: ThumbnailStudioStatus | null;
  onConfigure: () => void;
}) {
  if (!status) return null;

  if (status.provider === 'mock') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-900 dark:bg-blue-950/40">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
        <p className="text-blue-900 dark:text-blue-200">
          <b>Modo demonstração</b> — sem chave Gemini configurada, as imagens são placeholders
          (gradientes) só pra testar o fluxo. Configure sua chave em Configurações → Geração de
          thumbnails pra gerar imagens reais.
        </p>
      </div>
    );
  }

  if (status.canGenerate) return null;

  if (status.blockedReason === 'iniciante') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
        <Crown className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Geração de thumbnails é um recurso Pro
          </p>
          <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
            No plano Pro você usa sua própria chave do Google AI (Gemini). Faça upgrade pra liberar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
      <ImagePlus className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          Configure sua chave do Google AI (Gemini)
        </p>
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-200/80">
          A geração de thumbnails usa o Gemini. Cadastre sua chave pra liberar.
        </p>
        <button
          onClick={onConfigure}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
        >
          Configurar chave
        </button>
      </div>
    </div>
  );
}

function CharacterCard({
  character,
  onAddPhotos,
  onRemovePhoto,
  onRename,
  onDelete,
}: {
  character: ThumbnailCharacter;
  onAddPhotos: () => void;
  onRemovePhoto: (photoId: string) => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const few = character.photos.length < 5;
  return (
    <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <button onClick={onRename} className="min-w-0 text-left" title="Renomear">
          <p className="truncate text-sm font-medium">{character.name}</p>
          <p className="text-[11px] text-zinc-500">
            {character.photos.length} foto{character.photos.length === 1 ? '' : 's'}
            {few && ' · adicione mais pra melhorar'}
          </p>
        </button>
        <div className="flex shrink-0 gap-1">
          <Button onClick={onAddPhotos} variant="secondary" size="sm">
            <Plus className="h-3.5 w-3.5" />
            Fotos
          </Button>
          <button
            onClick={onDelete}
            title="Apagar personagem"
            aria-label="Apagar personagem"
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {character.photos.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {character.photos.map((p) => (
            <div key={p.id} className="group relative">
              <img
                src={p.dataUrl}
                alt=""
                className="h-14 w-14 rounded-lg object-cover"
              />
              <button
                onClick={() => onRemovePhoto(p.id)}
                title="Remover foto"
                aria-label="Remover foto"
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-zinc-300 py-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
          Sem fotos ainda — clique em "Fotos" pra enviar 5-10 imagens suas.
        </p>
      )}
    </div>
  );
}

function StyleSearch({
  onAdd,
  busy,
}: {
  onAdd: (videoId: string) => void;
  busy: boolean;
}) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<VideoThumbnailHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const hits = await window.api.thumbnails.searchVideos(q);
        if (!cancelled) setResults(hits);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term]);

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar vídeo por título…"
          className="h-9 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />
        )}
      </div>

      {term.trim().length >= 2 && results.length === 0 && !searching && (
        <p className="mt-2 text-xs text-zinc-500">Nenhum vídeo com esse título na sua base.</p>
      )}

      {results.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {results.map((v) => (
            <button
              key={v.id}
              onClick={() => onAdd(v.id)}
              disabled={busy}
              className="group overflow-hidden rounded-xl border border-zinc-200 text-left transition-colors hover:border-red-300 disabled:opacity-50 dark:border-zinc-800 dark:hover:border-red-800"
            >
              <div className="relative">
                {v.thumbnailUrl && (
                  <img src={v.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />
                )}
                {v.flaggedAsOutlier && (
                  <span className="absolute left-1 top-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {Math.round(v.outlierPercent ?? 0)}%
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                  <Plus className="h-6 w-6 text-white" />
                </span>
              </div>
              <div className="p-2">
                <p className="line-clamp-2 text-xs font-medium">{v.title}</p>
                {v.channelTitle && (
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-500">
                    <Film className="h-3 w-3" /> {v.channelTitle}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GenerationCard({
  gen,
  usdBrl,
  onExport,
  onDelete,
  onAdjust,
}: {
  gen: ThumbnailGeneration;
  usdBrl: number;
  onExport: () => void;
  onDelete: () => void;
  onAdjust: (genId: string, instruction: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!instruction.trim()) return;
    setBusy(true);
    try {
      await onAdjust(gen.id, instruction.trim());
      setInstruction('');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <img src={gen.dataUrl} alt="Thumbnail gerada" className="aspect-video w-full object-cover" />
      <div className="p-3">
        <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">{gen.prompt}</p>
        <p
          className="mt-1 cursor-pointer font-mono text-[9px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          title="Código pra puxar essa thumb num card do Kanban (clique pra copiar)"
          onClick={() => navigator.clipboard?.writeText(gen.id.slice(0, 8).toUpperCase())}
        >
          #{gen.id.slice(0, 8).toUpperCase()}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-zinc-400">
            {gen.provider === 'mock'
              ? 'demo'
              : gen.costEstimateUsd != null
                ? `~${formatBrl(gen.costEstimateUsd * usdBrl)}`
                : gen.model}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setOpen((v) => !v)}
              title="Ajustar"
              aria-label="Ajustar"
              className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-violet-600 dark:hover:bg-zinc-800 dark:hover:text-violet-400"
            >
              <Wand2 className="h-4 w-4" />
            </button>
            <button
              onClick={onExport}
              title="Baixar"
              aria-label="Baixar"
              className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              title="Apagar"
              aria-label="Apagar"
              className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {open && (
          <div className="mt-2 space-y-2">
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && apply()}
              placeholder={'Ajuste: ex. "muda o texto pra GANHEI R$50 MIL", "escurece o fundo"'}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
            <Button
              onClick={apply}
              disabled={busy || !instruction.trim()}
              variant="primary"
              size="sm"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              {busy ? 'Ajustando…' : 'Aplicar ajuste'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
