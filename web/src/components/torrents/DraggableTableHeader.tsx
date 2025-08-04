import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { flexRender, type Header } from '@tanstack/react-table'
import { GripVertical } from 'lucide-react'
import type { Torrent } from '@/types'

interface DraggableTableHeaderProps {
  header: Header<Torrent, unknown>
}

export function DraggableTableHeader({ header }: DraggableTableHeaderProps) {
  const { column } = header
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    position: 'relative' as const,
    width: header.getSize(),
    minWidth: header.getSize(),
    flexShrink: 0,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group"
    >
      <div
        className={`px-3 py-2 text-left text-sm font-medium text-muted-foreground overflow-hidden flex items-center ${
          column.getCanSort() ? 'cursor-pointer select-none hover:text-foreground' : ''
        }`}
      >
        {/* Drag handle with reserved space */}
        {!header.isPlaceholder && column.id !== 'select' ? (
          <div
            {...attributes}
            {...listeners}
            className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing touch-none mr-1 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3 w-3" />
          </div>
        ) : column.id === 'select' ? (
          // Reserve space for checkbox column to maintain alignment
          <div className="w-3 mr-1 flex-shrink-0" />
        ) : null}
        
        {/* Header content */}
        <div 
          className="flex items-center gap-1 truncate flex-1"
          onClick={column.getToggleSortingHandler()}
        >
          {header.isPlaceholder
            ? null
            : flexRender(
                column.columnDef.header,
                header.getContext()
              )}
          {{
            asc: ' ↑',
            desc: ' ↓',
          }[column.getIsSorted() as string] ?? null}
        </div>
      </div>
      
      {/* Resize handle */}
      {column.getCanResize() && (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none ${
            column.getIsResizing() 
              ? 'bg-primary opacity-100' 
              : 'bg-border hover:bg-primary/50 opacity-0 group-hover:opacity-100'
          }`}
        />
      )}
    </div>
  )
}