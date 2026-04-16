/**
 * Retrieval Configuration Panel
 *
 * Allows users to configure enhanced retrieval settings.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Zap, Shield, X, Save, RotateCcw } from 'lucide-react';

interface RetrievalConfigPanelProps {
  onClose?: () => void;
  onSave?: (config: ConfigState) => void;
}

interface ConfigState {
  modelContextWindow: 32000 | 64000 | 128000;
  minConfidenceThreshold: number;
  rerankerThreshold: number;
  enableDecomposition: boolean;
  enableRewrite: boolean;
  enableExpansion: boolean;
  maxSubQueries: number;
  maxExpandedTerms: number;
}

const defaultConfig: ConfigState = {
  modelContextWindow: 64000,
  minConfidenceThreshold: 0.3,
  rerankerThreshold: 20,
  enableDecomposition: true,
  enableRewrite: true,
  enableExpansion: true,
  maxSubQueries: 5,
  maxExpandedTerms: 5,
};

const contextWindowOptions = [
  { value: 32000, label: '32K (轻量)', description: '适合快速检索场景' },
  { value: 64000, label: '64K (标准)', description: '默认配置，平衡检索深度' },
  { value: 128000, label: '128K (扩展)', description: '适合复杂文档分析' },
];

const RetrievalConfigPanel: React.FC<RetrievalConfigPanelProps> = ({ onClose, onSave }) => {
  const [config, setConfig] = useState<ConfigState>(defaultConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // Fetch current config from server
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/chat/config');
        if (response.ok) {
          const data = await response.json();
          if (data.default) {
            setConfig({
              modelContextWindow: data.default.modelContextWindow || 64000,
              minConfidenceThreshold: data.default.minConfidenceThreshold || 0.3,
              rerankerThreshold: data.default.rerankerThreshold || 20,
              enableDecomposition: data.default.enableDecomposition ?? true,
              enableRewrite: data.default.enableRewrite ?? true,
              enableExpansion: data.default.enableExpansion ?? true,
              maxSubQueries: data.default.maxSubQueries || 5,
              maxExpandedTerms: data.default.maxExpandedTerms || 5,
            });
          }
        }
      } catch (error) {
        console.warn('Failed to fetch config:', error);
      }
    };

    fetchConfig();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/chat/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
        onSave?.(config);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(defaultConfig);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            检索配置
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Context Window */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          上下文窗口大小
        </label>
        <div className="space-y-2">
          {contextWindowOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setConfig({ ...config, modelContextWindow: option.value as 32000 | 64000 | 128000 })}
              className={`w-full p-3 rounded border text-left ${
                config.modelContextWindow === option.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Zap className={`w-4 h-4 ${
                  config.modelContextWindow === option.value
                    ? 'text-blue-600'
                    : 'text-gray-400'
                }`} />
                <span className="font-medium text-gray-900 dark:text-white">
                  {option.label}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {option.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Confidence Threshold */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Shield className="w-4 h-4 inline mr-1" />
          最小置信度阈值
        </label>
        <input
          type="range"
          min="0.1"
          max="0.5"
          step="0.05"
          value={config.minConfidenceThreshold}
          onChange={(e) => setConfig({ ...config, minConfidenceThreshold: parseFloat(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0.1 (宽松)</span>
          <span className="font-medium text-blue-600">
            {config.minConfidenceThreshold.toFixed(2)}
          </span>
          <span>0.5 (严格)</span>
        </div>
      </div>

      {/* Reranker Threshold */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          重排阈值 (样本数)
        </label>
        <input
          type="number"
          min="10"
          max="50"
          value={config.rerankerThreshold}
          onChange={(e) => setConfig({ ...config, rerankerThreshold: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <p className="text-xs text-gray-500 mt-1">
          ≤{config.rerankerThreshold}个结果使用本地模型，>{config.rerankerThreshold}个使用内部计算
        </p>
      </div>

      {/* Feature toggles */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          查询优化功能
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enableDecomposition}
              onChange={(e) => setConfig({ ...config, enableDecomposition: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              查询分解 (复杂问题拆分)
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enableRewrite}
              onChange={(e) => setConfig({ ...config, enableRewrite: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              查询重写 (口语→专业术语)
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enableExpansion}
              onChange={(e) => setConfig({ ...config, enableExpansion: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              同义词扩展
            </span>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-600">
        <button
          onClick={handleReset}
          className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <RotateCcw className="w-4 h-4" />
          重置
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 flex items-center justify-center gap-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? '保存中...' : '保存配置'}
        </button>
      </div>

      {/* Saved notification */}
      <AnimatePresence>
        {showSaved && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-4 right-4 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 px-3 py-1 rounded text-sm"
          >
            配置已保存
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default RetrievalConfigPanel;