"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FilePenLine,
  FilePlus2,
  Folder,
  FolderPlus,
  GripVertical,
  LogOut,
  Menu,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase-browser";
import { highlightMatches } from "@/lib/text";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Folder as FolderType, TranslationFile } from "@/types/database";

type FileFormState = {
  id?: string;
  folder_id: string;
  title: string;
  youtube_url: string;
  published_at: string;
  arabic_text: string;
  french_translation: string;
};

const emptyFileForm: FileFormState = {
  folder_id: "",
  title: "",
  youtube_url: "",
  published_at: "",
  arabic_text: "",
  french_translation: "",
};

export function AdminWorkspace() {
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [files, setFiles] = useState<TranslationFile[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [folderName, setFolderName] = useState("");
  const [fileForm, setFileForm] = useState<FileFormState>(emptyFileForm);
  const [isFilePanelOpen, setIsFilePanelOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [expandedTranslationIds, setExpandedTranslationIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingYoutubeTitle, setFetchingYoutubeTitle] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isConfigured = hasSupabaseConfig();

  const visibleFiles = useMemo(() => {
    if (selectedFolderId === "all" || searchQuery.trim()) {
      return files;
    }

    return files.filter((file) => file.folder_id === selectedFolderId);
  }, [files, searchQuery, selectedFolderId]);

  const canReorderFiles = false;

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      setAuthChecked(false);
      return;
    }

    void loadInitialData();
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured || !authChecked) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadFiles();
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [authChecked, isConfigured, searchQuery, selectedFolderId]);

  async function loadInitialData() {
    setLoading(true);
    setError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      setAuthChecked(true);

      const { data: folderRows, error: folderError } = await supabase
        .from("folders")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (folderError) {
        throw folderError;
      }

      setFolders(folderRows ?? []);
      await loadFiles();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  async function loadFiles() {
    setError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const query = searchQuery.trim();

      if (query) {
        const { data, error: searchError } = await supabase.rpc(
          "search_translation_files",
          {
            search_text: query,
          },
        );

        if (searchError) {
          throw searchError;
        }

        setFiles(
          (data ?? []).map((file) => ({
            ...file,
            folders: {
              id: file.folder_id,
              name: file.folder_name,
            },
          })),
        );
        return;
      }

      let request = supabase
        .from("files")
        .select("*, folders(id, name)")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (selectedFolderId !== "all") {
        request = request.eq("folder_id", selectedFolderId);
      }

      const { data, error: fileError } = await request;

      if (fileError) {
        throw fileError;
      }

      setFiles(
        (data ?? []).map((file) => {
          const folderValue = Array.isArray(file.folders)
            ? file.folders[0]
            : file.folders;

          return {
            ...file,
            folders: folderValue ?? null,
          } as TranslationFile;
        }),
      );
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  }

  async function handleCreateFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = folderName.trim();

    if (!name) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const { data, error: folderError } = await supabase
        .from("folders")
        .insert({ name, sort_order: folders.length })
        .select("*")
        .single();

      if (folderError) {
        throw folderError;
      }

      setFolders((current) => [...current, data]);
      setFolderName("");
      setSelectedFolderId(data.id);
      setIsMobileMenuOpen(false);
      setMessage("Dossier créé.");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  function openCreateFilePanel() {
    if (!folders.length) {
      setError("Créez d'abord un dossier avant d'ajouter un fichier.");
      setMessage("");
      return;
    }

    const defaultFolderId =
      selectedFolderId !== "all" ? selectedFolderId : folders.at(0)?.id ?? "";

    setFileForm({
      ...emptyFileForm,
      folder_id: defaultFolderId,
    });
    setIsFilePanelOpen(true);
    setIsMobileMenuOpen(false);
    setError("");
    setMessage("");
  }

  function openEditFilePanel(file: TranslationFile) {
    setFileForm({
      id: file.id,
      folder_id: file.folder_id,
      title: file.title,
      youtube_url: file.youtube_url ?? "",
      published_at: file.published_at ?? "",
      arabic_text: file.arabic_text ?? "",
      french_translation: file.french_translation ?? "",
    });
    setIsFilePanelOpen(true);
    setError("");
    setMessage("");
  }

  function toggleTranslation(fileId: string) {
    setExpandedTranslationIds((current) => {
      const next = new Set(current);

      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }

      return next;
    });
  }

  async function handleSaveFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = fileForm.title.trim();

    if (!title || !fileForm.folder_id) {
      setError("Le titre et le dossier sont obligatoires.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      folder_id: fileForm.folder_id,
      title,
      youtube_url: fileForm.youtube_url.trim() || null,
      published_at: fileForm.published_at || null,
      arabic_text: fileForm.arabic_text.trim() || null,
      french_translation: fileForm.french_translation.trim() || null,
      updated_at: new Date().toISOString(),
    };

    try {
      const supabase = getSupabaseBrowserClient();

      if (fileForm.id) {
        const { error: updateError } = await supabase
          .from("files")
          .update(payload)
          .eq("id", fileForm.id);

        if (updateError) {
          throw updateError;
        }

        setMessage("Fichier modifié.");
      } else {
        const folderFileCount = files.filter(
          (file) => file.folder_id === fileForm.folder_id,
        ).length;
        const { error: insertError } = await supabase
          .from("files")
          .insert({ ...payload, sort_order: folderFileCount });

        if (insertError) {
          throw insertError;
        }

        setMessage("Fichier créé.");
      }

      setIsFilePanelOpen(false);
      setFileForm(emptyFileForm);
      await loadFiles();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function fetchYoutubeTitle() {
    const youtubeUrl = fileForm.youtube_url.trim();

    if (!youtubeUrl || fileForm.title.trim() || fetchingYoutubeTitle) {
      return;
    }

    setFetchingYoutubeTitle(true);
    setError("");

    try {
      const response = await fetch(
        `/api/youtube-title?url=${encodeURIComponent(youtubeUrl)}`,
      );
      const data = (await response.json()) as {
        title?: unknown;
        error?: unknown;
      };

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Impossible de récupérer le titre YouTube.",
        );
      }

      if (typeof data.title === "string" && data.title.trim()) {
        const title = data.title.trim();

        setFileForm((current) => ({
          ...current,
          title: current.title.trim() ? current.title : title,
        }));
      }
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setFetchingYoutubeTitle(false);
    }
  }

  async function handleDeleteFile(file: TranslationFile) {
    const confirmed = window.confirm(
      `Supprimer définitivement le fichier "${file.title}" ?`,
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: deleteError } = await supabase
        .from("files")
        .delete()
        .eq("id", file.id);

      if (deleteError) {
        throw deleteError;
      }

      setFiles((current) => current.filter((currentFile) => currentFile.id !== file.id));
      setMessage("Fichier supprimé.");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSelectedFolder() {
    if (selectedFolderId === "all") {
      setError("Sélectionnez un dossier à supprimer.");
      setMessage("");
      return;
    }

    const folder = folders.find((currentFolder) => currentFolder.id === selectedFolderId);

    if (!folder) {
      setError("Dossier introuvable.");
      setMessage("");
      return;
    }

    const confirmed = window.confirm(
      `Supprimer définitivement le dossier "${folder.name}" et tous ses fichiers ?`,
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: deleteError } = await supabase
        .from("folders")
        .delete()
        .eq("id", folder.id);

      if (deleteError) {
        throw deleteError;
      }

      setFolders((current) =>
        current.filter((currentFolder) => currentFolder.id !== folder.id),
      );
      setFiles((current) =>
        current.filter((currentFile) => currentFile.folder_id !== folder.id),
      );
      setSelectedFolderId("all");
      setIsMobileMenuOpen(false);
      setMessage("Dossier supprimé.");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function handleFolderDrop(targetFolderId: string) {
    if (!draggedFolderId || draggedFolderId === targetFolderId) {
      setDraggedFolderId(null);
      return;
    }

    const reorderedFolders = reorderById(folders, draggedFolderId, targetFolderId);
    setFolders(reorderedFolders);
    setDraggedFolderId(null);
    await persistFolderOrder(reorderedFolders);
  }

  async function handleFileDrop(targetFileId: string) {
    if (!canReorderFiles || !draggedFileId || draggedFileId === targetFileId) {
      setDraggedFileId(null);
      return;
    }

    const folderFiles = visibleFiles.filter((file) => file.folder_id === selectedFolderId);
    const reorderedFolderFiles = reorderById(folderFiles, draggedFileId, targetFileId);
    const reorderedFileIds = new Set(reorderedFolderFiles.map((file) => file.id));

    setFiles((current) => [
      ...current.filter((file) => !reorderedFileIds.has(file.id)),
      ...reorderedFolderFiles,
    ]);
    setDraggedFileId(null);
    await persistFileOrder(reorderedFolderFiles);
  }

  async function moveFolder(folderId: string, direction: -1 | 1) {
    const currentIndex = folders.findIndex((folder) => folder.id === folderId);
    const nextIndex = currentIndex + direction;

    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= folders.length) {
      return;
    }

    const reorderedFolders = moveItem(folders, currentIndex, nextIndex);
    setFolders(reorderedFolders);
    await persistFolderOrder(reorderedFolders);
  }

  async function moveFile(fileId: string, direction: -1 | 1) {
    if (!canReorderFiles) {
      return;
    }

    const folderFiles = visibleFiles.filter((file) => file.folder_id === selectedFolderId);
    const currentIndex = folderFiles.findIndex((file) => file.id === fileId);
    const nextIndex = currentIndex + direction;

    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= folderFiles.length) {
      return;
    }

    const reorderedFolderFiles = moveItem(folderFiles, currentIndex, nextIndex);
    const reorderedFileIds = new Set(reorderedFolderFiles.map((file) => file.id));

    setFiles((current) => [
      ...current.filter((file) => !reorderedFileIds.has(file.id)),
      ...reorderedFolderFiles,
    ]);
    await persistFileOrder(reorderedFolderFiles);
  }

  async function persistFolderOrder(orderedFolders: FolderType[]) {
    setSaving(true);
    setError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const results = await Promise.all(
        orderedFolders.map((folder, index) =>
          supabase
            .from("folders")
            .update({ sort_order: index })
            .eq("id", folder.id),
        ),
      );
      const failedUpdate = results.find((result) => result.error);

      if (failedUpdate?.error) {
        throw failedUpdate.error;
      }
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      await loadInitialData();
    } finally {
      setSaving(false);
    }
  }

  async function persistFileOrder(orderedFiles: TranslationFile[]) {
    setSaving(true);
    setError("");

    try {
      const supabase = getSupabaseBrowserClient();
      const results = await Promise.all(
        orderedFiles.map((file, index) =>
          supabase
            .from("files")
            .update({ sort_order: index })
            .eq("id", file.id),
        ),
      );
      const failedUpdate = results.find((result) => result.error);

      if (failedUpdate?.error) {
        throw failedUpdate.error;
      }
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      await loadFiles();
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function renderSidebarContent(mode: "desktop" | "mobile") {
    const inputId = `folder-name-${mode}`;

    return (
      <>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-title text-xl leading-7 text-cream">
              Ceci est notre croyance
            </p>
            <p className="mt-1 text-sm text-muted">Bibliothèque des traductions</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={mode === "mobile" ? () => setIsMobileMenuOpen(false) : handleLogout}
              className="inline-flex h-10 w-10 items-center justify-center rounded border border-line/10 text-muted transition hover:border-gold/50 hover:text-gold"
              aria-label={mode === "mobile" ? "Fermer le menu" : "Se déconnecter"}
              title={mode === "mobile" ? "Fermer le menu" : "Se déconnecter"}
            >
              {mode === "mobile" ? (
                <X size={18} aria-hidden="true" />
              ) : (
                <LogOut size={18} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <form className="mt-8" onSubmit={handleCreateFolder}>
          <label className="text-sm text-cream" htmlFor={inputId}>
            Nouveau dossier
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id={inputId}
              className="gold-focus min-w-0 flex-1 rounded border border-line/10 bg-surface px-3 py-2.5 text-sm text-cream placeholder:text-muted"
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="Sermons"
            />
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded border border-gold/50 bg-gold/90 text-ink transition hover:bg-gold-light disabled:opacity-60"
              type="submit"
              disabled={saving || !folderName.trim()}
              aria-label="Créer un dossier"
              title="Créer un dossier"
            >
              <FolderPlus size={18} aria-hidden="true" />
            </button>
          </div>
        </form>

        <nav className="mt-8 space-y-2" aria-label="Dossiers">
          <button
            type="button"
            onClick={() => {
              setSelectedFolderId("all");
              setIsMobileMenuOpen(false);
            }}
            className={folderButtonClass(selectedFolderId === "all")}
          >
            <Search size={17} aria-hidden="true" />
            Tous les fichiers
          </button>
          {folders.map((folder, index) => (
            <div
              key={folder.id}
              draggable
              onDragStart={() => setDraggedFolderId(folder.id)}
              onDragEnd={() => setDraggedFolderId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleFolderDrop(folder.id)}
              className={`flex items-center gap-1 ${
                draggedFolderId === folder.id ? "opacity-45" : ""
              }`}
              title="Glisser ou utiliser les flèches pour réordonner"
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedFolderId(folder.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`${folderButtonClass(selectedFolderId === folder.id)} min-w-0 flex-1`}
              >
                <GripVertical
                  size={16}
                  className="hidden shrink-0 cursor-grab text-muted sm:block"
                  aria-hidden="true"
                />
                <Folder size={17} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{folder.name}</span>
              </button>
              <div className="flex shrink-0 gap-1 sm:hidden">
                <button
                  type="button"
                  onClick={() => moveFolder(folder.id, -1)}
                  disabled={saving || index === 0}
                  className="inline-flex h-9 w-9 items-center justify-center rounded border border-line/10 text-muted disabled:opacity-35"
                  aria-label={`Monter ${folder.name}`}
                >
                  <ChevronUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => moveFolder(folder.id, 1)}
                  disabled={saving || index === folders.length - 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded border border-line/10 text-muted disabled:opacity-35"
                  aria-label={`Descendre ${folder.name}`}
                >
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-8 grid gap-3">
          <button
            type="button"
            onClick={handleDeleteSelectedFolder}
            disabled={saving || selectedFolderId === "all"}
            className="inline-flex w-full items-center justify-center gap-2 rounded border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger transition hover:border-danger/45 hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Trash2 size={17} aria-hidden="true" />
            Supprimer le dossier
          </button>
          {mode === "mobile" ? (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex w-full items-center justify-center gap-2 rounded border border-line/10 px-4 py-3 text-sm font-semibold text-cream transition hover:border-gold/50 hover:text-gold"
            >
              <LogOut size={17} aria-hidden="true" />
              Se déconnecter
            </button>
          ) : null}
        </div>
      </>
    );
  }

  if (!isConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <section className="max-w-xl rounded-lg border border-gold/20 bg-panel p-8">
          <h1 className="font-title text-2xl text-cream">Configuration requise</h1>
          <p className="mt-4 leading-7 text-muted">
            Ajoutez `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`
            dans `.env.local`, puis redémarrez le serveur de développement.
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-night text-cream lg:flex">
      <div className="sticky top-0 z-40 border-b border-line/10 bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded border border-line/10 text-cream transition hover:border-gold/50 hover:text-gold"
            aria-label="Ouvrir le menu des dossiers"
            title="Ouvrir le menu des dossiers"
          >
            <Menu size={21} aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-title text-base text-cream">
              Ceci est notre croyance
            </p>
            <p className="truncate text-xs text-muted">
              {selectedFolderId === "all"
                ? "Tous les fichiers"
                : folders.find((folder) => folder.id === selectedFolderId)?.name ??
                  "Dossier"}
            </p>
          </div>
          <ThemeToggle />
          <button
            type="button"
            onClick={openCreateFilePanel}
            className="inline-flex h-11 w-11 items-center justify-center rounded border border-gold/50 bg-gold/90 text-ink transition hover:bg-gold-light"
            aria-label="Créer un fichier"
            title="Créer un fichier"
          >
            <FilePlus2 size={19} aria-hidden="true" />
          </button>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Fermer le menu"
          />
          <aside className="relative h-full w-[min(22rem,88vw)] overflow-y-auto border-r border-line/10 bg-panel p-5 shadow-premium">
            {renderSidebarContent("mobile")}
          </aside>
        </div>
      ) : null}

      <aside className="hidden bg-panel/95 p-5 backdrop-blur lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-80 lg:border-r lg:border-line/10">
        {renderSidebarContent("desktop")}
      </aside>

      <main className="w-full px-4 py-5 sm:px-5 lg:ml-80 lg:px-10 lg:py-9">
        <header className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-gold">
                Recherche
              </p>
              <h1 className="mt-2 font-title text-3xl text-cream md:text-4xl">
                Retrouver un passage traduit
              </h1>
            </div>
            <button
              type="button"
              onClick={openCreateFilePanel}
              className="inline-flex items-center justify-center gap-2 rounded border border-gold/60 px-4 py-3 text-sm font-semibold text-cream transition hover:bg-gold hover:text-ink"
            >
              <FilePlus2 size={17} aria-hidden="true" />
              Nouveau fichier
            </button>
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-lg border border-gold/25 bg-panel px-4 py-4 shadow-premium">
            <Search className="shrink-0 text-gold" size={22} aria-hidden="true" />
            <input
              className="w-full bg-transparent text-base text-cream outline-none placeholder:text-muted md:text-lg"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Rechercher dans les titres, le texte arabe ou la traduction..."
              aria-label="Recherche"
            />
          </div>
        </header>

        <section className="mx-auto mt-6 max-w-6xl">
          {error && !isFilePanelOpen ? (
            <p className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mb-4 rounded border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-cream">
              {message}
            </p>
          ) : null}

          {!folders.length && !loading ? (
            <EmptyState
              title="Aucun dossier"
              text="Créez un premier dossier avant d'ajouter vos fichiers de traduction."
            />
          ) : null}

          {loading ? (
            <div className="rounded-lg border border-line/10 bg-panel p-6 text-muted">
              Chargement de la bibliothèque...
            </div>
          ) : null}

          {!loading && folders.length ? (
            <div className="grid gap-4">
              {canReorderFiles ? (
                <p className="text-sm text-muted">
                  Glissez les fichiers pour choisir leur ordre dans ce dossier.
                </p>
              ) : null}
              {visibleFiles.length ? (
                visibleFiles.map((file, index) => {
                  const isTranslationExpanded = expandedTranslationIds.has(file.id);
                  const translation = file.french_translation?.trim();
                  const translationPanelId = `translation-${file.id}`;

                  return (
                    <article
                      key={file.id}
                      draggable={canReorderFiles}
                      onDragStart={() => canReorderFiles && setDraggedFileId(file.id)}
                      onDragEnd={() => setDraggedFileId(null)}
                      onDragOver={(event) => canReorderFiles && event.preventDefault()}
                      onDrop={() => handleFileDrop(file.id)}
                      className={`rounded-lg border border-line/10 bg-panel p-5 shadow-premium transition ${
                        draggedFileId === file.id ? "opacity-45" : ""
                      } ${canReorderFiles ? "cursor-grab" : ""}`}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 gap-3">
                          {canReorderFiles ? (
                            <GripVertical
                              size={18}
                              className="mt-1 hidden shrink-0 text-muted sm:block"
                              aria-hidden="true"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.18em] text-gold">
                              {file.folders?.name ?? file.folder_name ?? "Dossier"}
                            </p>
                            <h2 className="mt-2 break-words font-title text-xl text-cream">
                              {highlightMatches(file.title, searchQuery)}
                            </h2>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {canReorderFiles ? (
                            <div className="flex gap-1 sm:hidden">
                              <button
                                type="button"
                                onClick={() => moveFile(file.id, -1)}
                                disabled={saving || index === 0}
                                className="inline-flex h-9 w-9 items-center justify-center rounded border border-line/10 text-muted disabled:opacity-35"
                                aria-label={`Monter ${file.title}`}
                              >
                                <ChevronUp size={16} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveFile(file.id, 1)}
                                disabled={saving || index === visibleFiles.length - 1}
                                className="inline-flex h-9 w-9 items-center justify-center rounded border border-line/10 text-muted disabled:opacity-35"
                                aria-label={`Descendre ${file.title}`}
                              >
                                <ChevronDown size={16} aria-hidden="true" />
                              </button>
                            </div>
                          ) : null}
                          {file.youtube_url ? (
                            <a
                              className="inline-flex items-center gap-2 rounded border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-semibold text-cream transition hover:border-gold hover:bg-gold/20"
                              href={file.youtube_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink size={15} aria-hidden="true" />
                              YouTube
                            </a>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openEditFilePanel(file)}
                            className="inline-flex items-center gap-2 rounded border border-gold/50 px-3 py-2 text-sm text-cream transition hover:bg-gold hover:text-ink"
                          >
                            <FilePenLine size={15} aria-hidden="true" />
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFile(file)}
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm font-medium text-danger transition hover:border-danger/45 hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                            Supprimer
                          </button>
                        </div>
                      </div>

                      {translation ? (
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => toggleTranslation(file.id)}
                            className="inline-flex items-center gap-2 rounded border border-gold/35 px-3 py-2 text-sm font-semibold text-gold transition hover:border-gold hover:bg-gold/10"
                            aria-expanded={isTranslationExpanded}
                            aria-controls={translationPanelId}
                          >
                            {isTranslationExpanded ? (
                              <ChevronUp size={16} aria-hidden="true" />
                            ) : (
                              <ChevronDown size={16} aria-hidden="true" />
                            )}
                            {isTranslationExpanded
                              ? "Masquer la traduction"
                              : "Afficher la traduction"}
                          </button>

                          {isTranslationExpanded ? (
                            <div
                              id={translationPanelId}
                              className="mt-4 border-t border-line/10 pt-4"
                            >
                              <p className="break-words whitespace-pre-wrap text-sm leading-7 text-cream">
                                {highlightMatches(translation, searchQuery)}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <EmptyState
                  title={searchQuery.trim() ? "Aucun résultat" : "Aucun fichier"}
                  text={
                    searchQuery.trim()
                      ? "Aucun fichier ne contient cette recherche."
                      : "Ajoutez un premier fichier de traduction dans ce dossier."
                  }
                />
              )}
            </div>
          ) : null}
        </section>
      </main>

      {isFilePanelOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-surface/80 px-4 py-6 backdrop-blur">
          <form
            className="mx-auto max-w-3xl rounded-lg border border-gold/20 bg-panel p-5 shadow-premium md:p-7"
            onSubmit={handleSaveFile}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-gold">
                  {fileForm.id ? "Modification" : "Création"}
                </p>
                <h2 className="mt-2 font-title text-2xl text-cream">
                  {fileForm.id ? "Modifier le fichier" : "Nouveau fichier"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsFilePanelOpen(false)}
                className="rounded border border-line/10 px-3 py-2 text-sm text-muted transition hover:border-gold/50 hover:text-gold"
              >
                Fermer
              </button>
            </div>

            {error ? (
              <p className="mt-5 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <div className="mt-6 grid gap-5">
              <label className="block text-sm text-cream">
                Dossier
                <select
                  className="gold-focus mt-2 w-full rounded border border-line/10 bg-surface px-3 py-3 text-cream"
                  value={fileForm.folder_id}
                  onChange={(event) =>
                    setFileForm((current) => ({
                      ...current,
                      folder_id: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="" disabled>
                    Choisir un dossier
                  </option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-cream">
                Titre du fichier
                <input
                  className="gold-focus mt-2 w-full rounded border border-line/10 bg-surface px-3 py-3 text-cream placeholder:text-muted"
                  value={fileForm.title}
                  onChange={(event) =>
                    setFileForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Titre du cours ou du rappel"
                  required
                />
              </label>

              <label className="block text-sm text-cream">
                Lien YouTube
                <input
                  className="gold-focus mt-2 w-full rounded border border-line/10 bg-surface px-3 py-3 text-cream placeholder:text-muted"
                  value={fileForm.youtube_url}
                  onChange={(event) =>
                    setFileForm((current) => ({
                      ...current,
                      youtube_url: event.target.value,
                    }))
                  }
                  onBlur={fetchYoutubeTitle}
                  placeholder="https://www.youtube.com/watch?v=..."
                  type="url"
                />
                {fetchingYoutubeTitle ? (
                  <span className="mt-2 block text-xs text-muted">
                    Récupération du titre YouTube...
                  </span>
                ) : null}
              </label>

              <label className="block text-sm text-cream">
                Date de publication
                <input
                  className="gold-focus mt-2 w-full rounded border border-line/10 bg-surface px-3 py-3 text-cream placeholder:text-muted"
                  value={fileForm.published_at}
                  onChange={(event) =>
                    setFileForm((current) => ({
                      ...current,
                      published_at: event.target.value,
                    }))
                  }
                  type="date"
                />
              </label>

              <label className="block text-sm text-cream">
                Texte arabe écrit manuellement
                <textarea
                  className="gold-focus mt-2 min-h-44 w-full resize-y rounded border border-line/10 bg-surface px-3 py-3 leading-8 text-cream placeholder:text-muted"
                  value={fileForm.arabic_text}
                  onChange={(event) =>
                    setFileForm((current) => ({
                      ...current,
                      arabic_text: event.target.value,
                    }))
                  }
                  placeholder="Coller ou saisir le texte arabe..."
                  dir="auto"
                />
              </label>

              <label className="block text-sm text-cream">
                Traduction française
                <textarea
                  className="gold-focus mt-2 min-h-44 w-full resize-y rounded border border-line/10 bg-surface px-3 py-3 leading-7 text-cream placeholder:text-muted"
                  value={fileForm.french_translation}
                  onChange={(event) =>
                    setFileForm((current) => ({
                      ...current,
                      french_translation: event.target.value,
                    }))
                  }
                  placeholder="Saisir la traduction française..."
                />
              </label>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsFilePanelOpen(false)}
                className="rounded border border-line/10 px-5 py-3 text-cream transition hover:border-gold/50 hover:text-gold"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-gold px-5 py-3 font-semibold text-ink transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function folderButtonClass(active: boolean) {
  return [
    "flex w-full items-center gap-3 rounded px-3 py-2.5 text-left text-sm transition",
    active
      ? "bg-gold/15 text-gold"
      : "text-muted hover:bg-gold/10 hover:text-cream",
  ].join(" ");
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-line/10 bg-panel p-8 text-center">
      <h2 className="font-title text-xl text-cream">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">{text}</p>
    </div>
  );
}

function reorderById<T extends { id: string }>(
  items: T[],
  draggedId: string,
  targetId: string,
) {
  const draggedIndex = items.findIndex((item) => item.id === draggedId);
  const targetIndex = items.findIndex((item) => item.id === targetId);

  if (draggedIndex === -1 || targetIndex === -1) {
    return items;
  }

  const nextItems = [...items];
  const draggedItem = nextItems.splice(draggedIndex, 1)[0];

  if (!draggedItem) {
    return items;
  }

  nextItems.splice(targetIndex, 0, draggedItem);

  return nextItems;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const item = nextItems.splice(fromIndex, 1)[0];

  if (!item) {
    return items;
  }

  nextItems.splice(toIndex, 0, item);

  return nextItems;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const maybeError = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const textParts = [
      maybeError.message,
      maybeError.details,
      maybeError.hint,
      maybeError.code,
    ]
      .filter((part): part is string => typeof part === "string")
      .join(" ");

    if (
      maybeError.code === "23505" &&
      /files_youtube_url_unique_idx|youtube_url/i.test(textParts)
    ) {
      return "Cette video YouTube existe deja dans la bibliotheque.";
    }

    if (
      maybeError.code === "23505" &&
      /files_title_unique_idx|title/i.test(textParts)
    ) {
      return "Ce titre existe deja dans la bibliotheque.";
    }

    const parts = [maybeError.message, maybeError.details, maybeError.hint]
      .filter((part): part is string => typeof part === "string" && part.length > 0);

    if (parts.length) {
      const code =
        typeof maybeError.code === "string" ? ` (${maybeError.code})` : "";

      return `${parts.join(" ")}${code}`;
    }
  }

  return "Une erreur est survenue.";
}
