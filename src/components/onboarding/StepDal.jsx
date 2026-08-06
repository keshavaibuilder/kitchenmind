import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const DEFAULT_ORDER = [
  { id: 'masoor', label: 'Masoor Dal', sub: 'Red Lentil' },
  { id: 'toor',   label: 'Toor Dal',   sub: 'Yellow Lentil' },
  { id: 'moong',  label: 'Moong Dal',  sub: 'Green Lentil' },
  { id: 'chana',  label: 'Chana Dal',  sub: 'Split Chickpea' },
  { id: 'urad',   label: 'Urad Dal',   sub: 'Black Lentil' },
]

function SortableItem({ item, index }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-4 bg-white border-2 border-gray-100 rounded-xl px-4 h-16 cursor-grab active:cursor-grabbing select-none"
    >
      <span className="text-lg font-bold text-[#2E86AB] w-6">{index + 1}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#1E3A5F]">{item.label}</p>
        <p className="text-xs text-gray-400">{item.sub}</p>
      </div>
      <span className="text-gray-300 text-xl">⠿</span>
    </div>
  )
}

export default function StepDal({ value, onChange, onNext }) {
  const items = value.length ? value : DEFAULT_ORDER

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      onChange(arrayMove(items, oldIndex, newIndex))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-bold text-[#1E3A5F] leading-snug">
        Which dal does the family love most?
      </h2>
      <p className="text-gray-500 text-sm mt-2 mb-6">
        Drag to rank — your favourite at the top
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3 mb-auto">
            {items.map((item, index) => (
              <SortableItem key={item.id} item={item} index={index} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={onNext}
        className="mt-8 w-full h-14 rounded-xl bg-[#1E3A5F] text-white font-semibold active:scale-95 transition-transform"
      >
        This is our order →
      </button>
    </div>
  )
}
