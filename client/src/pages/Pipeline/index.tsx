import { useEffect, useState, useCallback } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDraggable } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import type { Lead, LeadStatus } from '../../types';
import { STATUSES } from '../../types';

function DroppableColumn({ status, children }: { status: LeadStatus; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = STATUSES.find((s) => s.value === status)!;

  return (
    <div
      ref={setNodeRef}
      className={`bg-gray-50 rounded-xl p-3 min-h-[200px] transition-colors ${isOver ? 'ring-2 ring-blue-400 bg-brand/10' : ''}`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${config.color.split(' ')[0]}`} />
          <h3 className="font-semibold text-sm text-gray-700">{config.label}</h3>
        </div>
        <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full">
          {Array.isArray(children) ? children.length : 0}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DraggableCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: isDragging ? 999 : 'auto' }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      onClick={onClick}
      className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${isDragging ? 'opacity-80 shadow-lg rotate-1' : ''}`}
    >
      <p className="text-sm font-medium text-gray-900 truncate">{lead.name}</p>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-xs text-gray-400">
          {lead.source === 'web' ? '🌐' : lead.source === 'ig_ads' ? '📱' : '📌'}
        </span>
        {lead.email && <span className="text-xs text-gray-400 truncate">{lead.email}</span>}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchLeads = useCallback(async () => {
    const res = await api.get('/leads');
    setLeads(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as LeadStatus;

    const validStatuses: LeadStatus[] = ['nuevo', 'contactado', 'calificado', 'enviar_propuesta', 'negociacion', 'cerrado', 'perdido'];
    if (!validStatuses.includes(newStatus)) return;

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );

    await api.patch(`/leads/${leadId}/status`, { status: newStatus });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  const columns: LeadStatus[] = ['nuevo', 'contactado', 'calificado', 'enviar_propuesta', 'negociacion', 'cerrado', 'perdido'];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pipeline de Ventas</h1>
      <p className="text-sm text-gray-500 mb-4">Arrastra los leads entre columnas para cambiar su estado</p>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 gap-3">
          {columns.map((status) => {
            const columnLeads = leads.filter((l) => l.status === status);
            return (
              <DroppableColumn key={status} status={status}>
                <SortableContext items={columnLeads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  {columnLeads.map((lead) => (
                    <DraggableCard
                      key={lead.id}
                      lead={lead}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    />
                  ))}
                </SortableContext>
              </DroppableColumn>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
