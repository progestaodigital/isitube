-- Biblioteca pessoal: campos novos em videos.
--
-- Why: usuário quer "salvar" vídeos pra consultar depois, independente do
-- monitoramento do canal. inLibrary = flag de pertencimento, libraryAddedAt
-- = ordem padrão da listagem, libraryNotes = anotação livre opcional.
--
-- Backwards-compat: ADD COLUMN com defaults nullable é seguro — bases
-- existentes herdam inLibrary=false sem precisar de backfill manual.

ALTER TABLE "videos" ADD COLUMN "in_library" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "videos" ADD COLUMN "library_added_at" DATETIME;
ALTER TABLE "videos" ADD COLUMN "library_notes" TEXT;

CREATE INDEX "videos_in_library_library_added_at_idx" ON "videos"("in_library", "library_added_at");
