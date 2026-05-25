'use client';

import { DoorOpen } from 'lucide-react';
import { useRoomUtilization } from '../hooks/use-scheduling';

interface RoomUtilizationPanelProps {
  branchId: string;
  selectedDate: Date;
}

export function RoomUtilizationPanel({ branchId, selectedDate }: RoomUtilizationPanelProps) {
  const dateStr = selectedDate.toISOString().split('T')[0];
  const { data: utilization, isLoading } = useRoomUtilization(branchId, dateStr, dateStr);

  return (
    <aside className="room-utilization-panel">
      <div className="panel-header">
        <div>
          <h3>Загрузка кабинетов</h3>
          <p className="muted">Эффективность использования кабинетов филиала на выбранную дату.</p>
        </div>
        <DoorOpen size={20} />
      </div>

      <div className="panel-body">
        {isLoading ? (
          <p className="muted">Загрузка статистики...</p>
        ) : utilization?.length ? (
          <div className="room-utilization-list">
            {utilization.map((room) => {
              const utilVal = room.utilizationPercent;
              // Determine visual bar color based on utilization rate
              let colorClass = 'bar-low';
              if (utilVal > 70) colorClass = 'bar-high';
              else if (utilVal > 30) colorClass = 'bar-medium';

              return (
                <div className="room-util-item" key={room.roomId}>
                  <div className="room-util-info">
                    <strong>
                      {room.roomName} ({room.roomCode})
                    </strong>
                    <span>
                      Записей: {room.totalAppointments} · {room.totalMinutesBooked} мин
                    </span>
                  </div>
                  <div className="room-util-bar-wrap">
                    <div className="room-util-bar-bg">
                      <div
                        className={`room-util-bar-fill ${colorClass}`}
                        style={{ width: `${utilVal}%` }}
                      />
                    </div>
                    <span className="room-util-percentage">{utilVal}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div>
              <strong>Нет данных о кабинетах</strong>
              <span>Кабинеты не настроены для данного филиала.</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
