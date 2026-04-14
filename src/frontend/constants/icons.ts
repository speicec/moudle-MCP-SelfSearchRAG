/**
 * Icon constants for Lucide React
 * Centralized icon exports with default styling
 */
import {
  Brain,
  BookOpen,
  Loader2,
  ChevronRight,
  ChevronDown,
  Check,
  Lightbulb,
  Upload,
  FileText,
  Trash2,
  Search,
  Layers,
  Grid,
  List,
  ArrowUp,
  ArrowDown,
  Clock,
  BarChart3,
  Database,
  Zap,
  AlertCircle,
  CheckCircle,
  XCircle,
  File,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react';

// Icon component type
export type IconComponent = LucideIcon;

// Default icon sizes
export const ICON_SIZE_SM = 'w-3 h-3';
export const ICON_SIZE_MD = 'w-4 h-4';
export const ICON_SIZE_LG = 'w-5 h-5';
export const ICON_SIZE_XL = 'w-6 h-6';

// Icon mapping for common UI elements
export const Icons = {
  // Status indicators
  loading: Loader2,
  success: Check,
  error: XCircle,
  warning: AlertCircle,
  info: Lightbulb,

  // Chat/Thinking
  brain: Brain,
  book: BookOpen,
  clock: Clock,

  // Navigation
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,

  // Documents
  file: File,
  fileText: FileText,
  folder: FolderOpen,
  upload: Upload,
  trash: Trash2,

  // View modes
  grid: Grid,
  list: List,
  layers: Layers,

  // Actions
  search: Search,
  check: Check,

  // Stats
  barChart: BarChart3,
  database: Database,
  zap: Zap,
  checkCircle: CheckCircle,
};

// Default icon props
export const defaultIconProps = {
  size: ICON_SIZE_MD,
  className: 'text-gray-500 dark:text-gray-400',
};

// Animated loading icon props
export const loadingIconProps = {
  size: ICON_SIZE_MD,
  className: 'animate-spin text-blue-500',
};