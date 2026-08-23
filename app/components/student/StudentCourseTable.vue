<script setup>
// ============================================================
// Props
// ============================================================

const props =
  defineProps({
    packages: {
      type: Array,
      default: () => [],
    },

    resettingId: {
      type: String,
      default: '',
    },
  })

// ============================================================
// Emits
// ============================================================

const emit =
  defineEmits([
    'reset',
  ])

// ============================================================
// Format
// ============================================================

const formatDate = (
  value,
) => {
  if (
    !value
  ) {
    return '-'
  }

  return String(
    value,
  ).slice(
    0,
    10,
  )
}

const formatTime = (
  value,
) => {
  return String(
    value || '',
  ).slice(
    0,
    5,
  )
}

const formatMoney = (
  value,
) => {
  return new Intl.NumberFormat(
    'zh-TW',
    {
      maximumFractionDigits:
        0,
    },
  ).format(
    Number(
      value || 0,
    ),
  )
}

// ============================================================
// Status
// ============================================================

const getStatusLabel = (
  item,
) => {
  if (
    item.status ===
    'CANCELLED'
  ) {
    return '已取消'
  }

  if (
    item.is_completed
  ) {
    return '已完成'
  }

  return '進行中'
}

// ============================================================
// Reset
// ============================================================

const reset = (
  packageData,
) => {
  if (
    !packageData.can_reset
  ) {
    return
  }

  emit(
    'reset',
    packageData,
  )
}
</script>

<template>
  <div class="table-wrapper">
    <table
      v-if="packages.length"
      class="course-table"
    >
      <thead>
        <tr>
          <th>
            課程
          </th>

          <th>
            輪次
          </th>

          <th>
            購買
          </th>

          <th>
            上課進度
          </th>

          <th>
            狀態
          </th>

          <th>
            開始日期
          </th>

          <th>
            上完日期
          </th>

          <th>
            付款
          </th>

          <th>
            操作
          </th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="item in packages"
          :key="item.id"
        >
          <!-- ================================================
               Course
               ================================================ -->

          <td data-label="課程">
            <strong>
              {{ item.course_name }}
            </strong>

            <small>
              {{
                formatTime(
                  item.start_time
                )
              }}
              –
              {{
                formatTime(
                  item.end_time
                )
              }}
            </small>
          </td>

          <!-- ================================================
               Round
               ================================================ -->

          <td data-label="輪次">
            第
            {{
              item.cycle_no ||
              1
            }}
            輪
          </td>

          <!-- ================================================
               Purchased
               ================================================ -->

          <td data-label="購買">
            {{
              item.purchased_cycles ||
              1
            }}
            期

            <small>
              {{
                item.total_sessions
              }}
              堂 /
              $
              {{
                formatMoney(
                  item.price
                )
              }}
            </small>
          </td>

          <!-- ================================================
               Progress
               ================================================ -->

          <td data-label="上課進度">
            <strong class="progress-number">
              {{
                item.used_sessions
              }}
              /
              {{
                item.total_sessions
              }}
            </strong>

            <small
              v-if="
                !item.is_completed
              "
            >
              剩
              {{
                item.remaining_sessions
              }}
              堂
            </small>
          </td>

          <!-- ================================================
               Status
               ================================================ -->

          <td data-label="狀態">
            <span
              class="status"
              :class="{
                completed:
                  item.is_completed,

                cancelled:
                  item.status ===
                    'CANCELLED',
              }"
            >
              {{
                getStatusLabel(
                  item
                )
              }}
            </span>
          </td>

          <!-- ================================================
               Start Date
               ================================================ -->

          <td data-label="開始日期">
            {{
              formatDate(
                item.start_date
              )
            }}
          </td>

          <!-- ================================================
               Completed Date
               ================================================ -->

          <td data-label="上完日期">
            {{
              item.is_completed
                ? formatDate(
                    item.completion_class_date
                  )
                : '-'
            }}
          </td>

          <!-- ================================================
               Payment
               ================================================ -->

          <td data-label="付款">
            <span
              class="payment"
              :class="{
                unpaid:
                  !item.paid,
              }"
            >
              {{
                item.paid
                  ? '已付款'
                  : '未付款'
              }}
            </span>
          </td>

          <!-- ================================================
               Action
               ================================================ -->

          <td data-label="操作">
            <button
              v-if="
                item.can_reset
              "
              type="button"
              class="reset-button"
              :disabled="
                resettingId ===
                  String(
                    item.id
                  )
              "
              @click="
                reset(
                  item
                )
              "
            >
              {{
                resettingId ===
                  String(
                    item.id
                  )
                  ? '處理中...'
                  : 'Reset'
              }}
            </button>

            <span
              v-else
              class="no-action"
            >
              -
            </span>
          </td>
        </tr>
      </tbody>
    </table>

    <div
      v-else
      class="empty"
    >
      目前沒有符合條件的課程紀錄。
    </div>
  </div>
</template>

<style scoped>
.table-wrapper {
  width: 100%;
  overflow-x: auto;
}

.course-table {
  width: 100%;
  border-collapse: collapse;
  background: #ffffff;
  border-radius: 14px;
  overflow: hidden;
}

.course-table th,
.course-table td {
  padding: 11px 10px;
  border-bottom: 1px solid #eeeeee;
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

.course-table th {
  background: #fafafa;
  color: #888888;
  font-size: 8px;
  font-weight: 500;
}

.course-table td {
  color: #555555;
  font-size: 8px;
}

.course-table tbody tr:last-child td {
  border-bottom: 0;
}

.course-table td > strong {
  color: #222222;
  font-size: 9px;
}

.course-table small {
  display: block;
  margin-top: 3px;
  color: #999999;
  font-size: 7px;
}

.progress-number {
  font-size: 11px !important;
}

.status,
.payment {
  display: inline-block;
  padding: 5px 7px;
  border-radius: 999px;
  background: #eeeeee;
  color: #666666;
  font-size: 7px;
}

.status.completed {
  background: #eaf7ec;
  color: #418b4b;
}

.status.cancelled {
  background: #fff0f0;
  color: #c94343;
}

.payment {
  background: #eaf7ec;
  color: #418b4b;
}

.payment.unpaid {
  background: #fff5df;
  color: #856319;
}

.reset-button {
  min-height: 31px;
  padding: 0 10px;
  border: 0;
  background: #222222;
  border-radius: 7px;
  color: #ffffff;
  font-size: 7px;
}

.reset-button:disabled {
  opacity: 0.4;
}

.no-action {
  color: #bbbbbb;
}

.empty {
  padding: 28px;
  background: #ffffff;
  border-radius: 13px;
  color: #aaaaaa;
  font-size: 9px;
  text-align: center;
}

/* ============================================================
   Mobile
   ============================================================ */

@media (
  max-width: 720px
) {
  .table-wrapper {
    overflow: visible;
  }

  .course-table,
  .course-table thead,
  .course-table tbody,
  .course-table tr,
  .course-table th,
  .course-table td {
    display: block;
    width: 100%;
  }

  .course-table {
    background: transparent;
  }

  .course-table thead {
    display: none;
  }

  .course-table tr {
    margin-bottom: 8px;
    padding: 12px;
    background: #ffffff;
    border-radius: 13px;
  }

  .course-table td {
    display: grid;
    grid-template-columns:
      88px
      1fr;
    gap: 10px;
    padding: 7px 0;
    border: 0;
    white-space: normal;
  }

  .course-table td::before {
    content:
      attr(
        data-label
      );
    color: #999999;
    font-size: 7px;
  }
}
</style>