import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileUp,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  CloudUpload,
  FileDown,
} from 'lucide-react';

/**
 * ClinicalUploadArea - Medical sample collection interface
 *
 * Design: Lab sample submission aesthetic
 * - Drop zone styled as specimen collection tray
 * - Processing status with clinical monitoring style
 * - Drag-and-drop with visual feedback
 * - Upload progress as processing indicator
 */

interface ClinicalUploadAreaProps {
  onFileSelect: (file: File) => void;
  uploadProgress: number;
  isUploading?: boolean;
  acceptedTypes?: string[];
  maxFileSize?: number; // in MB
}

const ClinicalUploadArea: React.FC<ClinicalUploadAreaProps> = ({
  onFileSelect,
  uploadProgress,
  isUploading = false,
  acceptedTypes = ['.pdf', '.txt', '.md'],
  maxFileSize = 50,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndSelect(file);
    }
  };

  const validateAndSelect = (file: File) => {
    // Check file size
    const maxSizeBytes = maxFileSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setDragError(`文件过大，最大支持 ${maxFileSize}MB`);
      setTimeout(() => setDragError(null), 3000);
      return;
    }

    // Check file type
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(extension)) {
      setDragError(`不支持该文件类型，支持: ${acceptedTypes.join(', ')}`);
      setTimeout(() => setDragError(null), 3000);
      return;
    }

    setDragError(null);
    onFileSelect(file);
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSelect(file);
    }
  }, [acceptedTypes, maxFileSize]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // Progress status
  const progressStatus = uploadProgress === 0 ? 'idle'
    : uploadProgress < 100 ? 'uploading'
    : 'complete';

  return (
    <motion.div
      className="clinical-upload-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="clinical-upload-header">
        <div className="clinical-upload-header-title">
          <CloudUpload className="w-4 h-4" />
          <span>样本采集</span>
        </div>
        <div className="clinical-upload-header-badge">
          医学文档上传
        </div>
      </div>

      {/* Drop Zone */}
      <motion.div
        className={`clinical-upload-dropzone ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        animate={isDragging ? { borderColor: 'var(--clinical-primary)' } : {}}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="clinical-upload-input-hidden"
          accept={acceptedTypes.join(',')}
          onChange={handleFileChange}
          aria-label="选择文件上传"
        />

        {/* Drop zone content */}
        <AnimatePresence mode="wait">
          {isUploading ? (
            <motion.div
              key="uploading"
              className="clinical-upload-uploading-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="clinical-upload-spinner"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <FileUp className="w-8 h-8" />
              </motion.div>
              <div className="clinical-upload-progress-label">
                正在处理样本...
              </div>
            </motion.div>
          ) : isDragging ? (
            <motion.div
              key="dragging"
              className="clinical-upload-dragging-state"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <FileDown className="w-8 h-8 clinical-upload-drop-icon" />
              <div className="clinical-upload-drop-label">
                释放以采集样本
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              className="clinical-upload-idle-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="clinical-upload-icon-wrapper">
                <Upload className="w-6 h-6" />
              </div>
              <div className="clinical-upload-main-label">
                点击或拖拽上传医学文档
              </div>
              <div className="clinical-upload-sub-label">
                支持 PDF、TXT、MD 格式，最大 {maxFileSize}MB
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {dragError && (
          <motion.div
            className="clinical-upload-error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <AlertCircle className="w-4 h-4" />
            <span>{dragError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress indicator */}
      <AnimatePresence>
        {uploadProgress > 0 && (
          <motion.div
            className="clinical-upload-progress"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="clinical-upload-progress-header">
              <span className="clinical-upload-progress-label">
                {progressStatus === 'complete' ? '采集完成' : '处理进度'}
              </span>
              <span className="clinical-upload-progress-value">
                {uploadProgress}%
              </span>
            </div>

            {/* Progress bar with clinical style */}
            <div className="clinical-upload-progress-bar">
              <motion.div
                className="clinical-upload-progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
                data-status={progressStatus}
              />
            </div>

            {/* Status indicator */}
            <div className="clinical-upload-progress-status">
              {progressStatus === 'uploading' && (
                <motion.div
                  className="clinical-upload-status-item processing"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Loader2 className="w-3 h-3" />
                  <span>正在解析文档结构...</span>
                </motion.div>
              )}
              {progressStatus === 'complete' && (
                <motion.div
                  className="clinical-upload-status-item complete"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>样本已成功入库</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ClinicalUploadArea;