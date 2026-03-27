import { Paper, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';

function ReportTable({ orders, type, onRowClick, selectedOrderId }) {
  return (
    <Paper elevation={3} className="p-4">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Order ID</TableCell>
            <TableCell>Job Type</TableCell>
            <TableCell>Recipe</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Created At</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.map((order) => (
            <TableRow
              key={order.id}
              hover
              selected={selectedOrderId === order.id}
              onClick={() => onRowClick && onRowClick(order.id)}
              style={{ cursor: 'pointer' }}
            >
              <TableCell>{order.id}</TableCell>
              <TableCell>{order.job_type || order.job_type_id}</TableCell>
              <TableCell>{order.recipe_name}</TableCell>
              <TableCell>{order.status}</TableCell>
              <TableCell>{new Date(order.created_at).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

export default ReportTable; 