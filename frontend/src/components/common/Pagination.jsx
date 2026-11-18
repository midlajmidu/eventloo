import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const Pagination = ({ 
  currentPage, 
  totalPages, 
  totalCount, 
  pageSize, 
  onPageChange, 
  onPageSizeChange,
  showPageSizeSelector = true,
  compact = false,
  className = ""
}) => {
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = compact ? 3 : 5;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages around current page
      let start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      let end = Math.min(totalPages, start + maxVisiblePages - 1);
      
      // Adjust start if we're near the end
      if (end === totalPages) {
        start = Math.max(1, end - maxVisiblePages + 1);
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  if (totalPages <= 1) {
    return null;
  }

  if (compact) {
    return (
      <div className={`flex items-center justify-between gap-2 py-1 text-xs text-slate-500 ${className}`}>
        {/* Page info */}
        <div className="text-[11px] sm:text-xs text-slate-500 whitespace-nowrap">
          Showing <span className="font-semibold text-slate-700">{startItem}</span> to{' '}
          <span className="font-semibold text-slate-700">{endItem}</span> of{' '}
          <span className="font-semibold text-slate-700">{totalCount}</span> results
        </div>

        {/* Navigation controls */}
        <div className="flex items-center space-x-1 sm:space-x-1.5">
          {showPageSizeSelector && onPageSizeChange && (
            <div className="flex items-center space-x-1 text-xs text-slate-500 mr-1">
              <span className="hidden sm:inline text-[11px]">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700 outline-none focus:border-indigo-400 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          )}

          <div className="flex items-center space-x-0.5">
            <button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-100 transition-colors"
              title="First page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-100 transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {pageNumbers.map((page) => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`min-w-[24px] h-6 px-1.5 text-xs font-semibold rounded transition-colors ${
                  currentPage === page
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-100 transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-100 transition-colors"
              title="Last page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      {/* Page info */}
      <div className="text-sm text-slate-700">
        Showing <span className="font-medium">{startItem}</span> to{' '}
        <span className="font-medium">{endItem}</span> of{' '}
        <span className="font-medium">{totalCount}</span> results
      </div>

      {/* Pagination controls */}
      <div className="flex items-center space-x-2">
        {/* Page size selector */}
        {showPageSizeSelector && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-700">Show:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center space-x-1">
          {/* First page */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md hover:bg-slate-100"
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Previous page */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md hover:bg-slate-100"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Page numbers */}
          {pageNumbers.map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                currentPage === page
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {page}
            </button>
          ))}

          {/* Next page */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md hover:bg-slate-100"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Last page */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md hover:bg-slate-100"
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pagination; 
