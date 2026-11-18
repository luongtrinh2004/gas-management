"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Tab from "@mui/material/Tab";
import TabContext from "@mui/lab/TabContext";
import TabPanel from "@mui/lab/TabPanel";
import CustomTabList from "@core/components/mui/TabList";
import PageHeader from "@components/app/PageHeader";
import DataTable, { col, colFn } from "@components/app/DataTable";
import DataTableToolbar from "@components/DataTableToolbar";
import FormDialog from "@components/app/FormDialog";
import StatusChip from "@components/app/StatusChip";
import CustomChip from "@core/components/mui/Chip";
import ConfirmDialog from "@components/ConfirmDialog";
import { SelectField, DateField, toOptions } from "@components/app/fields";
import { useList } from "@components/app/useList";
import { useOptions } from "@components/app/useOptions";
import { useAction } from "@components/app/useAction";
import { useSession } from "@components/SessionProvider";
import { api } from "@/utils/api";
import { fmtDate, fmtMoney, fmtNum } from "@/utils/format";
import { MATERIAL_TX, PAY_METHODS } from "@/server/constants";

const EMPTY = {};
const TX_COLOR = { in: "success", sale: "primary", gift: "warning" };
const today = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

function Catalog() {
  const s = useSession();
  const act = useAction();
  const { data, isFetching } = useQuery({
    queryKey: ["materials-stock"],
    queryFn: () => api("/materials/stock"),
  });
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [tx, setTx] = useState(null);
  const fields = [
    { name: "name", label: "Tên vật tư", required: true },
    { name: "code", label: "Mã vật tư", xs: 6, helper: "Để trống để tự sinh" },
    { name: "unit", label: "Đơn vị tính", xs: 6, required: true },
    { name: "defaultPrice", label: "Giá bán mặc định", type: "money", xs: 6 },
    {
      name: "status",
      label: "Trạng thái",
      type: "select",
      allowEmpty: false,
      xs: 6,
      options: [
        { value: "active", label: "Đang dùng" },
        { value: "inactive", label: "Ngừng" },
      ],
    },
    { name: "note", label: "Ghi chú", type: "textarea" },
  ];
  const columns = [
    col("Vật tư", "name"),
    col("Mã", "code"),
    col("ĐVT", "unit", { align: "center" }),
    colFn("Đã nhập", (r) => r.in, {
      align: "right",
      cell: ({ row: { original: r } }) => fmtNum(r.in),
    }),
    colFn("Đã bán", (r) => r.sale, {
      align: "right",
      cell: ({ row: { original: r } }) => fmtNum(r.sale),
    }),
    colFn("Đã tặng", (r) => r.gift, {
      align: "right",
      cell: ({ row: { original: r } }) => fmtNum(r.gift),
    }),
    colFn("Tồn kho", (r) => r.stock, {
      align: "right",
      cell: ({ row: { original: r } }) => <b>{fmtNum(r.stock)}</b>,
    }),
    colFn("Giá bán MĐ", (r) => r.defaultPrice, {
      align: "right",
      cell: ({ row: { original: r } }) => fmtMoney(r.defaultPrice),
    }),
    colFn("Trạng thái", (r) => r.status, {
      align: "center",
      cell: ({ row: { original: r } }) => <StatusChip status={r.status} />,
    }),
    {
      header: "Thao tác",
      id: "actions",
      meta: { align: "center" },
      cell: ({ row: { original: r } }) => (
        <div className="flex items-center justify-center gap-1">
          <Tooltip title="Nhập / bán / tặng">
            <IconButton
              size="small"
              color="primary"
              onClick={() =>
                setTx({
                  material: r._id,
                  type: "sale",
                  date: today(),
                  unitPrice: r.defaultPrice,
                  payMethod: "cash",
                })
              }
            >
              <i className="tabler-arrows-exchange text-[20px]" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Sửa">
            <IconButton size="small" onClick={() => setEdit(r)}>
              <i className="tabler-edit text-[20px]" />
            </IconButton>
          </Tooltip>
          {s.role === "admin" && (
            <Tooltip title="Xóa">
              <IconButton size="small" color="error" onClick={() => setDel(r)}>
                <i className="tabler-trash text-[20px]" />
              </IconButton>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];
  return (
    <>
      <div className="flex justify-end gap-2 mbe-4">
        <Button
          variant="tonal"
          startIcon={<i className="tabler-arrows-exchange" />}
          onClick={() =>
            setTx({ type: "in", date: today(), payMethod: "cash" })
          }
        >
          Nhập / bán / tặng
        </Button>
        <Button
          variant="contained"
          startIcon={<i className="tabler-plus" />}
          onClick={() => setEdit({ status: "active", unit: "cái" })}
        >
          Thêm vật tư
        </Button>
      </div>
      <Card>
        <DataTable columns={columns} rows={data || []} loading={isFetching} />
      </Card>
      <FormDialog
        open={!!edit}
        title={edit?._id ? "Sửa vật tư" : "Thêm vật tư"}
        fields={fields}
        initial={edit}
        onClose={() => setEdit(null)}
        onSubmit={(v) =>
          act(edit?._id ? `/materials/${edit._id}` : "/materials", {
            method: edit?._id ? "PUT" : "POST",
            body: v,
            ok: "Đã lưu",
          })
        }
      />
      <ConfirmDialog
        open={!!del}
        message={`Xóa vật tư "${del?.name}"?`}
        confirmText="Xóa"
        onClose={() => setDel(null)}
        onConfirm={async () => {
          await act(`/materials/${del._id}`, {
            method: "DELETE",
            ok: "Đã xóa",
          }).catch(() => {});
          setDel(null);
        }}
      />
      <TxDialog tx={tx} onClose={() => setTx(null)} />
    </>
  );
}

function TxDialog({ tx, onClose }) {
  const act = useAction();
  const mats = useOptions("/materials/options");
  const custs = useOptions("/customers/options");
  const fields = [
    {
      name: "type",
      label: "Loại giao dịch",
      type: "select",
      allowEmpty: false,
      options: toOptions(MATERIAL_TX),
      xs: 6,
      required: true,
    },
    { name: "date", label: "Ngày", type: "date", xs: 6, required: true },
    {
      name: "material",
      label: "Vật tư",
      type: "select",
      options: mats.options,
      required: true,
    },
    { name: "qty", label: "Số lượng", type: "number", xs: 6, required: true },
    {
      name: "unitPrice",
      label: "Đơn giá",
      type: "money",
      xs: 6,
      hidden: (v) => v.type === "gift",
    },
    {
      name: "paidAmount",
      label: "Tiền đã thu/chi",
      type: "money",
      xs: 6,
      hidden: (v) => v.type === "gift",
      helper: "Tự sinh phiếu thu/chi trong mục Thu chi",
    },
    {
      name: "payMethod",
      label: "Hình thức",
      type: "select",
      allowEmpty: false,
      options: toOptions(PAY_METHODS),
      xs: 6,
      hidden: (v) => v.type === "gift",
    },
    {
      name: "customer",
      label: "Khách hàng (nếu có)",
      type: "select",
      options: custs.options,
      hidden: (v) => v.type === "in",
    },
    { name: "note", label: "Ghi chú", type: "textarea" },
  ];
  return (
    <FormDialog
      open={!!tx}
      title="Giao dịch vật tư"
      fields={fields}
      initial={tx}
      onClose={onClose}
      onSubmit={(v) =>
        act("/material-tx", { body: v, ok: "Đã ghi nhận giao dịch" })
      }
    />
  );
}

function Transactions() {
  const s = useSession();
  const act = useAction();
  const list = useList("/material-tx", {
    material: "",
    type: "",
    from: "",
    to: "",
  });
  const mats = useOptions("/materials/options");
  const [voiding, setVoiding] = useState(null);
  const columns = useMemo(
    () => [
      colFn("Ngày", (r) => r.date, {
        cell: ({ row: { original: r } }) => fmtDate(r.date),
      }),
      colFn("Loại", (r) => r.type, {
        align: "center",
        cell: ({ row: { original: r } }) => (
          <CustomChip
            round="true"
            variant="tonal"
            size="small"
            color={TX_COLOR[r.type]}
            label={MATERIAL_TX[r.type]}
          />
        ),
      }),
      col("Vật tư", "materialName"),
      colFn("Số lượng", (r) => r.qty, {
        align: "right",
        cell: ({ row: { original: r } }) => fmtNum(r.qty),
      }),
      colFn("Đơn giá", (r) => r.unitPrice, {
        align: "right",
        cell: ({ row: { original: r } }) =>
          r.type === "gift" ? "—" : fmtMoney(r.unitPrice),
      }),
      colFn("Thành tiền", (r) => r.amount, {
        align: "right",
        cell: ({ row: { original: r } }) =>
          r.type === "gift" ? "—" : fmtMoney(r.amount),
      }),
      colFn("Đã thu/chi", (r) => r.paidAmount, {
        align: "right",
        cell: ({ row: { original: r } }) =>
          r.type === "gift" ? "—" : fmtMoney(r.paidAmount),
      }),
      colFn("Khách hàng", (r) => r.customerName),
      col("Người ghi nhận", "createdByName"),
      colFn("Trạng thái", (r) => r.void, {
        align: "center",
        cell: ({ row: { original: r } }) => (
          <StatusChip status={r.void ? "void" : "confirmed"} />
        ),
      }),
      ...(["admin", "accountant"].includes(s.role)
        ? [
            {
              header: "Thao tác",
              id: "a",
              meta: { align: "center" },
              cell: ({ row: { original: r } }) =>
                !r.void && (
                  <Tooltip title="Hủy giao dịch">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setVoiding(r)}
                    >
                      <i className="tabler-ban text-[20px]" />
                    </IconButton>
                  </Tooltip>
                ),
            },
          ]
        : []),
    ],
    [s.role],
  );
  return (
    <>
      <Card>
        <DataTableToolbar
          search={list.search}
          onSearchChange={list.setSearch}
          limit={list.limit}
          onLimitChange={list.setLimit}
          placeholder="Tìm vật tư, khách, ghi chú…"
          itemLabel="giao dịch"
        >
          <div style={{ minWidth: 170 }}>
            <SelectField
              options={mats.options}
              placeholder="Vật tư"
              value={list.filters.material}
              onChange={(v) => list.setFilter("material", v)}
            />
          </div>
          <div style={{ minWidth: 130 }}>
            <SelectField
              options={toOptions(MATERIAL_TX)}
              placeholder="Loại"
              value={list.filters.type}
              onChange={(v) => list.setFilter("type", v)}
            />
          </div>
          <div style={{ width: 150 }}>
            <DateField
              value={list.filters.from}
              onChange={(v) => list.setFilter("from", v)}
            />
          </div>
          <div style={{ width: 150 }}>
            <DateField
              value={list.filters.to}
              onChange={(v) => list.setFilter("to", v)}
            />
          </div>
        </DataTableToolbar>
        <DataTable
          columns={columns}
          rows={list.rows}
          total={list.total}
          page={list.page}
          limit={list.limit}
          onPageChange={list.onPageChange}
          loading={list.isFetching}
        />
      </Card>
      <FormDialog
        open={!!voiding}
        title="Hủy giao dịch vật tư"
        fields={[
          {
            name: "reason",
            label: "Lý do hủy",
            type: "textarea",
            required: true,
          },
        ]}
        initial={EMPTY}
        submitText="Xác nhận hủy"
        onClose={() => setVoiding(null)}
        onSubmit={(v) =>
          act(`/material-tx/${voiding._id}/void`, {
            body: v,
            ok: "Đã hủy giao dịch",
          })
        }
      />
    </>
  );
}

export default function MaterialsPage() {
  const [tab, setTab] = useState("catalog");
  return (
    <>
      <PageHeader
        title="Vật tư"
        subtitle="Găng tay, tạp dề, bếp đơn, chế bếp… — nhập, bán, tặng và tồn kho"
      />
      <TabContext value={tab}>
        <CustomTabList
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          pill="true"
          className="mbe-4"
        >
          <Tab
            value="catalog"
            label="Danh mục & tồn kho"
            icon={<i className="tabler-package" />}
            iconPosition="start"
          />
          <Tab
            value="tx"
            label="Giao dịch"
            icon={<i className="tabler-history" />}
            iconPosition="start"
          />
        </CustomTabList>
        <TabPanel value="catalog" sx={{ p: 0 }}>
          <Catalog />
        </TabPanel>
        <TabPanel value="tx" sx={{ p: 0 }}>
          <Transactions />
        </TabPanel>
      </TabContext>
    </>
  );
}
