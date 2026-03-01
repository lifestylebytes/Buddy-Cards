"use client";

import { useCallback, useState } from "react";
import { Upload, Camera, Loader2, BookOpen } from "lucide-react";
import { ExtractedWord } from "@/types/vocab";

interface Props {
  onExtracted: (words: ExtractedWord[], imageBase64: string) => void;
}

export default function ImageUploader({ onExtracted }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("이미지 파일만 업로드할 수 있어요!");
        return;
      }

      setError(null);
      setLoading(true);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        setPreview(dataUrl);

        try {
          const res = await fetch("/api/extract-vocab", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: base64,
              mimeType: file.type,
            }),
          });

          if (!res.ok) throw new Error("분석 실패");

          const data = await res.json();
          if (data.error) throw new Error(data.error);

          onExtracted(data.words || [], base64);
        } catch (err) {
          setError("이미지 분석에 실패했어요. 다시 시도해주세요.");
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    },
    [onExtracted]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center w-full min-h-64 rounded-3xl border-2 border-dashed cursor-pointer transition-all duration-300
          ${isDragging ? "border-violet-400 bg-violet-50 scale-[1.02]" : "border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/30"}
          ${loading ? "pointer-events-none" : ""}
        `}
      >
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleInput}
          disabled={loading}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-4 p-8">
            {preview && (
              <div className="relative w-40 h-28 rounded-2xl overflow-hidden shadow-lg mb-2">
                <img
                  src={preview}
                  alt="분석 중"
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-violet-900/20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-violet-600 font-medium">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>밑줄 친 단어 분석 중...</span>
            </div>
            <p className="text-sm text-slate-400">Claude AI가 어휘를 추출하고 있어요</p>
          </div>
        ) : preview ? (
          <div className="flex flex-col items-center gap-3 p-8">
            <div className="w-40 h-28 rounded-2xl overflow-hidden shadow-lg">
              <img src={preview} alt="미리보기" className="w-full h-full object-cover" />
            </div>
            <p className="text-sm text-slate-500">다른 사진을 올리려면 클릭하세요</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 p-10">
            <div className="w-20 h-20 rounded-2xl bg-violet-100 flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-violet-500" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-700">
                원서 사진을 올려주세요
              </p>
              <p className="text-sm text-slate-400 mt-1">
                밑줄 친 단어를 자동으로 인식해요
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-xs text-slate-500">
                <Upload className="w-3.5 h-3.5" />
                파일 업로드
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-xs text-slate-500">
                <Camera className="w-3.5 h-3.5" />
                카메라 촬영
              </div>
            </div>
          </div>
        )}
      </label>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 text-center">
          {error}
        </div>
      )}
    </div>
  );
}
