<script setup>
// ============================================================
// Props
// ============================================================

const props =
  defineProps({
    packageData: {
      type: Object,
      required: true,
    },
  })

// ============================================================
// Emits
// ============================================================

const emit =
  defineEmits([
    'renew',
  ])

// ============================================================
// Format
// ============================================================

const formatDate = (
  value
) => {
  if (
    !value
  ) {
    return '-'
  }

  return String(
    value
  ).slice(
    0,
    10
  )
}

const formatTime = (
  value
) => {
  return String(
    value || ''
  ).slice(
    0,
    5
  )
}

const formatMoney = (
  value
) => {
  return new Intl
    .NumberFormat(
      'zh-TW',
      {
        maximumFractionDigits:
          0,
      }
    )
    .format(
      Number(
        value || 0
      )
    )
}

// ============================================================
// State
// ============================================================

const usedSessions =
  computed(() => {
    return Number(
      props.packageData
        .used_sessions ||
      0
    )
  })

const totalSessions =
  computed(() => {
    return Number(
      props.packageData
        .total_sessions ||
      0
    )
  })

const remainingSessions =
  computed(() => {
    return Math.max(
      totalSessions.value -
      usedSessions.value,
      0
    )
  })

const progress =
  computed(() => {
    if (
      totalSessions.value <=
      0
    ) {
      return 0
    }

    return Math.min(
      Math.round(
        (
          usedSessions.value /
          totalSessions.value
        ) *
        100
      ),
      100
    )
  })

const isCompleted =
  computed(() => {
    return (
      usedSessions.value >=
      totalSessions.value
    )
  })

const isActive =
  computed(() => {
    return (
      props.packageData.status ===
      'ACTIVE'
    )
  })

// ============================================================
// Renew
// ============================================================

const renew =
  () => {
    emit(
      'renew',
      props.packageData
    )
  }
</script>

<template>
  <article
    class="package-card"
    :class="{
      completed:
        isCompleted,
    }"
  >
    <!-- ======================================================
         Header
         ====================================================== -->

    <header>
      <div>
        <span>
          {{
            isCompleted
              ? '本輪完成'
              : '目前方案'
          }}
        </span>

        <h2>
          {{
            packageData.course_name
          }}
        </h2>

        <p>
          主要時段：
          星期
          {{
            {
              1: '一',
              2: '二',
              3: '三',
              4: '四',
              5: '五',
              6: '六',
              7: '日',
            }[
              Number(
                packageData
                  .primary_weekday
              )
            ]
          }}

          {{
            formatTime(
              packageData
                .primary_start_time
            )
          }}
          –
          {{
            formatTime(
              packageData
                .primary_end_time
            )
          }}
        </p>
      </div>

      <span
        class="status"
        :class="{
          completed:
            isCompleted,
        }"
      >
        {{
          isCompleted
            ? '完成'
            : '進行中'
        }}
      </span>
    </header>

    <!-- ======================================================
         Big Progress
         ====================================================== -->

    <section class="progress-area">
      <div class="progress-number">
        <strong>
          {{
            usedSessions
          }}
        </strong>

        <span>
          /
          {{
            totalSessions
          }}
          堂
        </span>
      </div>

      <div class="progress-right">
        <span>
          {{
            isCompleted
              ? '本輪已全部上完'
              : `剩 ${remainingSessions} 堂`
          }}
        </span>
      </div>

      <div class="progress-track">
        <div
          class="progress-value"
          :style="{
            width:
              `${progress}%`,
          }"
        />
      </div>
    </section>

    <!-- ======================================================
         Package Info
         ====================================================== -->

    <section class="package-info">
      <div>
        <span>
          開始日期
        </span>

        <strong>
          {{
            formatDate(
              packageData.start_date
            )
          }}
        </strong>
      </div>

      <div>
        <span>
          本次購買
        </span>

        <strong>
          {{
            packageData
              .purchased_cycles
          }}
          期
        </strong>
      </div>

      <div>
        <span>
          每期
        </span>

        <strong>
          {{
            packageData
              .sessions_per_cycle
          }}
          堂
        </strong>
      </div>

      <div>
        <span>
          金額
        </span>

        <strong>
          $
          {{
            formatMoney(
              packageData.price
            )
          }}
        </strong>
      </div>
    </section>

    <!-- ======================================================
         Payment
         ====================================================== -->

    <div class="payment">
      <span>
        {{
          packageData.paid
            ? '已付款'
            : '未付款'
        }}
      </span>

      <span>
        第
        {{
          packageData.cycle_no
        }}
        輪
      </span>
    </div>

    <!-- ======================================================
         Renew
         ====================================================== -->

    <button
      v-if="
        isCompleted &&
        isActive
      "
      type="button"
      class="renew-button"
      @click="
        renew
      "
    >
      開始下一輪
    </button>
  </article>
</template>

<style scoped>
.package-card {
  padding: 17px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 17px;
}

.package-card.completed {
  border-color: #c9dfcd;
}

.package-card > header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.package-card header > div > span {
  color: #999999;
  font-size: 8px;
}

.package-card h2 {
  margin: 4px 0 0;
  font-size: 18px;
}

.package-card header p {
  margin: 4px 0 0;
  color: #888888;
  font-size: 8px;
}

.status {
  height: fit-content;
  padding: 5px 9px;
  background: #222222;
  border-radius: 999px;
  color: #ffffff;
  font-size: 8px;
}

.status.completed {
  background: #eaf7ec;
  color: #418b4b;
}

/* ============================================================
   Progress
   ============================================================ */

.progress-area {
  position: relative;
  margin-top: 14px;
  padding: 14px;
  background: #222222;
  border-radius: 13px;
  color: #ffffff;
}

.progress-number {
  display: flex;
  align-items: flex-end;
}

.progress-number strong {
  font-size: 30px;
  line-height: 1;
}

.progress-number span {
  margin-left: 5px;
  color: rgb(255 255 255 / 60%);
  font-size: 10px;
}

.progress-right {
  position: absolute;
  top: 16px;
  right: 14px;
}

.progress-right span {
  color: rgb(255 255 255 / 65%);
  font-size: 8px;
}

.progress-track {
  height: 6px;
  margin-top: 12px;
  overflow: hidden;
  background: rgb(255 255 255 / 18%);
  border-radius: 999px;
}

.progress-value {
  height: 100%;
  background: #ffffff;
  border-radius: 999px;
}

/* ============================================================
   Info
   ============================================================ */

.package-info {
  display: grid;
  grid-template-columns:
    repeat(
      4,
      1fr
    );
  gap: 6px;
  margin-top: 9px;
}

.package-info > div {
  padding: 9px;
  background: #f7f7f7;
  border-radius: 9px;
}

.package-info span {
  display: block;
  color: #999999;
  font-size: 7px;
}

.package-info strong {
  display: block;
  margin-top: 4px;
  font-size: 9px;
}

.payment {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 9px;
  color: #999999;
  font-size: 7px;
}

.renew-button {
  width: 100%;
  min-height: 39px;
  margin-top: 12px;
  border: 0;
  background: #222222;
  border-radius: 10px;
  color: #ffffff;
  font-size: 9px;
}

@media (
  max-width: 520px
) {
  .package-info {
    grid-template-columns:
      1fr
      1fr;
  }
}
</style>