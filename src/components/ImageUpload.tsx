import { Button } from '@/components/ui/button';
import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileImage } from 'lucide-react';

interface ImageUploadProps {
  onImageSelected: (dataUrl: string) => void;
  label?: string;
  compact?: boolean;
}

export function ImageUpload({ onImageSelected, label = 'Upload screenshot', compact = false }: ImageUploadProps) {
  const [image, setImage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImage(dataUrl);
      onImageSelected(dataUrl);
    };
    reader.readAsDataURL(file);
  }, [onImageSelected]);

  const clear = useCallback(() => {
    setImage(null);
    onImageSelected('');
  }, [onImageSelected]);

  if (image) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-border">
        <img src={image} alt="Uploaded" className="w-full max-h-48 object-cover" />
        <Button variant="source"
          onClick={clear}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-study-black/60 text-study-white hover:bg-study-black/80 transition-colors"
        >
          <X size={16} />
        </Button>
      </div>
    );
  }

  if (compact) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <Button variant="source"
          onClick={() => inputRef.current?.click()}
          className="p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
          title={label}
        >
          <Upload size={18} />
        </Button>
      </>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        e.dataTransfer.files?.[0] && handleFile(e.dataTransfer.files[0]);
      }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
        dragging ? 'border-accent-500 bg-accent-50/10' : 'border-border hover:border-border-light'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <FileImage className="mx-auto mb-3 text-text-muted" size={32} />
      <p className="text-sm text-text font-medium">{label}</p>
      <p className="text-xs text-text-dim mt-1">Drag & drop or click to browse — PNG, JPG, WEBP</p>
    </div>
  );
}
