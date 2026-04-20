import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '../ui/button';

interface UploadAreaProps {
  onFileSelect: (file: File) => void;
  uploadProgress: number;
}

const UploadArea: React.FC<UploadAreaProps> = ({ onFileSelect, uploadProgress }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="border-2 border-dashed rounded-lg p-6">
      <div className="text-center">
        <label className="cursor-pointer">
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">
            点击上传或拖拽文件
          </span>
          <br />
          <span className="text-sm text-muted-foreground">
            支持 PDF、TXT、MD 文件（最大 50MB）
          </span>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.txt,.md"
            onChange={handleFileChange}
            aria-label="文件上传"
          />
        </label>

        {/* Upload progress */}
        {uploadProgress > 0 && (
          <div className="mt-4">
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground mt-1">
              {uploadProgress < 100 ? '上传中...' : '上传完成！'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadArea;