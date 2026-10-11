"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  ArrowUp,
  CheckCircle2,
  X,
  Loader2,
  FileVideo,
  ArrowRight,
  Sparkles,
  Paperclip,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  ChatInput,
  ChatInputTextArea,
  ChatInputSubmit,
} from "@/components/ui/chat-input";
import { Button } from "@/components/ui/button";

type AttachedMedia =
  | {
      kind: "video";
      file: File;
      name: string;
      size: string;
      type: string;
      url: string;
    }
  | {
      kind: "images";
      files: File[];
      count: number;
      totalSize: string;
      names: string[];
    };

const PIPELINE_STAGES = [
  { id: 1, title: "Ingesting AST", desc: "Parsing repository tree, package metadata & top source files" },
  { id: 2, title: "Running Gemma 4", desc: "Cross-referencing codebase logic with multimodal demo video or screenshots" },
  { id: 3, title: "Computing Digest", desc: "Generating deterministic SHA-256 evaluation fingerprint" },
  { id: 4, title: "Avalanche Tx", desc: "Signing & broadcasting record to AgentJudgeRegistry on Fuji" },
  { id: 5, title: "Finalizing", desc: "Confirming block settlement & verifying immutable verdict" },
];

export default function HomePage() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [attachedMedia, setAttachedMedia] = useState<AttachedMedia | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [activeStage, setActiveStage] = useState<number>(0);
  const [completedId, setCompletedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);

    // Identify video vs image files
    const videoFiles = files.filter(
      (f) =>
        f.type.startsWith("video/") ||
        f.name.endsWith(".mp4") ||
        f.name.endsWith(".webm") ||
        f.name.endsWith(".mov")
    );

    const imageFiles = files.filter(
      (f) =>
        f.type.startsWith("image/") ||
        f.name.endsWith(".png") ||
        f.name.endsWith(".jpg") ||
        f.name.endsWith(".jpeg") ||
        f.name.endsWith(".webp")
    );

    // Mutual exclusivity: either 1 video OR up to 4 images
    if (videoFiles.length > 0 && imageFiles.length > 0) {
      toast.error("Please upload either 1 video file OR up to 4 images, not both.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (videoFiles.length > 1) {
      toast.error("Please upload only 1 video file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (videoFiles.length === 1) {
      const vid = videoFiles[0];
      if (vid.size > 50 * 1024 * 1024) {
        toast.error("Video file exceeds 50MB limit.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      if (attachedMedia?.kind === "video") {
        URL.revokeObjectURL(attachedMedia.url);
      }

      const sizeInMb = (vid.size / (1024 * 1024)).toFixed(1);
      const objectUrl = URL.createObjectURL(vid);

      setAttachedMedia({
        kind: "video",
        file: vid,
        name: vid.name,
        size: `${sizeInMb} MB`,
        type: vid.type || "video/mp4",
        url: objectUrl,
      });

      toast.success(`Attached demo video "${vid.name}"`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (imageFiles.length > 0) {
      if (imageFiles.length > 4) {
        toast.error("You can upload a maximum of 4 images.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      for (const img of imageFiles) {
        if (img.size > 10 * 1024 * 1024) {
          toast.error(`Image "${img.name}" exceeds 10MB limit.`);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
      }

      if (attachedMedia?.kind === "video") {
        URL.revokeObjectURL(attachedMedia.url);
      }

      const totalBytes = imageFiles.reduce((acc, f) => acc + f.size, 0);
      const totalSizeMb = (totalBytes / (1024 * 1024)).toFixed(1);

      setAttachedMedia({
        kind: "images",
        files: imageFiles,
        count: imageFiles.length,
        names: imageFiles.map((f) => f.name),
        totalSize: `${totalSizeMb} MB`,
      });

      toast.success(`Attached ${imageFiles.length} UI screenshot${imageFiles.length > 1 ? "s" : ""}`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    toast.error("Please upload supported image (.png, .jpg, .webp) or video (.mp4, .webm, .mov) files.");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeMedia = () => {
    if (attachedMedia?.kind === "video") {
      URL.revokeObjectURL(attachedMedia.url);
    }
    setAttachedMedia(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = repoUrl.trim();
    if (!trimmed) {
      toast.error("Please enter a valid GitHub repository URL.");
      return;
    }

    if (!trimmed.includes("github.com/")) {
      toast.error("URL must be a GitHub repository (e.g. https://github.com/owner/repo)");
      return;
    }

    setIsEvaluating(true);
    setCompletedId(null);
    setActiveStage(1);

    const t1 = setTimeout(() => setActiveStage(2), 1600);
    const t2 = setTimeout(() => setActiveStage(3), 4800);
    const t3 = setTimeout(() => setActiveStage(4), 8500);

    try {
      let res: Response;

      if (attachedMedia?.kind === "video") {
        const formData = new FormData();
        formData.append("repoUrl", trimmed);
        formData.append("demoVideo", attachedMedia.file);
        res = await fetch("/api/evaluate", {
          method: "POST",
          body: formData,
        });
      } else if (attachedMedia?.kind === "images") {
        const formData = new FormData();
        formData.append("repoUrl", trimmed);
        attachedMedia.files.forEach((file) => {
          formData.append("screenshots", file);
        });
        res = await fetch("/api/evaluate", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoUrl: trimmed,
            screenshots: [],
          }),
        });
      }

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      const data = await res.json();

      if (!res.ok && !data.evaluation) {
        throw new Error(data.error || "Evaluation failed to execute.");
      }

      setActiveStage(5);
      const evalId = data.id || `eval-${Date.now().toString(36)}`;
      setCompletedId(evalId);

      toast.success("Evaluation complete! Navigating to results...");
      setTimeout(() => {
        router.push(`/evaluate/${evalId}`);
      }, 1400);

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Evaluation failed.";
      toast.error(msg);
    } finally {
      setIsEvaluating(false);
      setActiveStage(0);
    }
  };

  const fillSampleRepo = () => {
    setRepoUrl("https://github.com/ethereum/solidity");
  };

  return (
    <main className="relative min-h-[calc(100dvh-4rem)] w-full overflow-hidden bg-black text-white antialiased flex flex-col justify-between selection:bg-white/20 selection:text-white">
      {/* ──────────────── Cosmic Background Visuals ──────────────── */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Conic Starburst Rays */}
        <div className="cosmic-rays animate-slow-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[1200px] w-[1200px] md:h-[1800px] md:w-[1800px] opacity-75" />

        {/* Ambient Radial Deep Space Core */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] md:h-[900px] md:w-[900px] rounded-full bg-radial from-white/[0.08] via-zinc-900/[0.03] to-transparent blur-3xl animate-subtle-pulse" />

        {/* Cosmic Grid Mesh */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-40" />
      </div>

      {/* ──────────────── Main Content Hero & ChatInput ──────────────── */}
      <section className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-12 md:py-16">
        {/* Hero Headline & Clean Subtitle (No slop pills) */}
        <div className="text-center max-w-2xl space-y-4 mb-10">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-4xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-white leading-[1.08]"
          >
            Give your codebase a verdict.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed"
          >
            Autonomous multimodal hackathon evaluator. Submit your GitHub repository and demo video or screenshots for Gemma 4 analysis with immutable settlement on Avalanche Fuji.
          </motion.p>
        </div>

        {/* ──────────────── Central Unified Agent Chat Input Area ──────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="w-full max-w-2xl space-y-3"
        >
          {/* Demo Attachment Preview Above Input */}
          <AnimatePresence>
            {attachedMedia && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/80 p-3 backdrop-blur-xl shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                      {attachedMedia.kind === "video" ? (
                        <FileVideo className="h-5 w-5 text-indigo-400" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-emerald-400" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-200 truncate max-w-[280px]">
                          {attachedMedia.kind === "video"
                            ? attachedMedia.name
                            : `${attachedMedia.count} UI Screenshot${attachedMedia.count > 1 ? "s" : ""}`}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">
                          {attachedMedia.kind === "video" ? "Video" : "Screenshots"}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500 truncate max-w-[320px]">
                        {attachedMedia.kind === "video"
                          ? `${attachedMedia.size} • ${attachedMedia.type}`
                          : `${attachedMedia.totalSize} • ${attachedMedia.names.join(", ")}`}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeMedia}
                    disabled={isEvaluating}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    title="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Central ChatInput Form */}
          <form onSubmit={handleSubmit} className="w-full">
            <ChatInput className="border-white/10 bg-zinc-950/80 shadow-[0_0_50px_-15px_rgba(255,255,255,0.06)] backdrop-blur-2xl">
              <ChatInputTextArea
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!isEvaluating) handleSubmit();
                  }
                }}
                disabled={isEvaluating}
                placeholder="Paste GitHub repository URL (e.g. https://github.com/owner/repo)..."
                className="text-zinc-100 placeholder:text-zinc-500 text-sm md:text-base"
              />

              {/* Chat Input Bottom Bar */}
              <div className="flex w-full items-center justify-between border-t border-white/5 pt-2 px-1">
                <div className="flex items-center gap-2">
                  {/* Hidden File Input accepting images and video formats */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isEvaluating}
                  />

                  {/* Attach Media Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isEvaluating}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 gap-1.5 px-3 text-xs text-zinc-400 hover:text-white hover:bg-white/10 rounded-full"
                    title="Attach Demo (Video or Screenshots)"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-zinc-300" />
                    <span>Attach Demo (Video or Screenshots)</span>
                  </Button>

                  <button
                    type="button"
                    onClick={fillSampleRepo}
                    disabled={isEvaluating}
                    className="hidden sm:inline-flex text-[11px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors ml-1"
                  >
                    Try sample repo
                  </button>
                </div>

                {/* Submit Action Button */}
                <ChatInputSubmit
                  disabled={!repoUrl.trim() || isEvaluating}
                  loading={isEvaluating}
                  className="bg-white text-black hover:bg-zinc-200"
                >
                  {isEvaluating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-900" />
                  ) : (
                    <ArrowUp className="h-4 w-4 text-zinc-950" />
                  )}
                </ChatInputSubmit>
              </div>
            </ChatInput>
          </form>

          {/* Post-evaluation view CTA */}
          {completedId && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center pt-2"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/evaluate/${completedId}`)}
                className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                <span>View Evaluation Verdict</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          )}
        </motion.div>

        {/* ──────────────── Animated Stepper: 5 Pipeline Stages ──────────────── */}
        <AnimatePresence>
          {isEvaluating && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950/70 p-6 backdrop-blur-xl shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span className="text-sm font-medium text-white">
                    Praetor Evaluation Pipeline
                  </span>
                </div>
                <span className="text-xs font-mono text-zinc-400">
                  Stage {activeStage} of 5
                </span>
              </div>

              <div className="space-y-3">
                {PIPELINE_STAGES.map((st) => {
                  const isDone = activeStage > st.id;
                  const isCurrent = activeStage === st.id;
                  return (
                    <div
                      key={st.id}
                      className={`flex items-start gap-3 rounded-lg p-2.5 transition-colors ${
                        isCurrent
                          ? "bg-white/5 border border-white/10"
                          : "opacity-40"
                      }`}
                    >
                      <div className="mt-0.5">
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : isCurrent ? (
                          <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-zinc-600" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-zinc-200">
                          {st.title}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {st.desc}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}
