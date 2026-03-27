import { Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody, Divider } from '@mui/material';

function OrderDetailsPanel({ details }) {
  if (details.error) return <Paper className="p-4"><Typography color="error">{details.error}</Typography></Paper>;
  return (
    <Paper elevation={3} className="p-4">
      <Typography variant="h6" gutterBottom>Order Details</Typography>
      <Divider className="my-2" />
      <Typography variant="subtitle1">KPIs</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Value</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {details.kpis && Object.entries(details.kpis).map(([k, v]) => (
            <TableRow key={k}>
              <TableCell>{k}</TableCell>
              <TableCell>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Divider className="my-2" />
      <Typography variant="subtitle1">Sources</Typography>
      <ul>
        {details.sources && details.sources.map((src, i) => (
          <li key={i}>{JSON.stringify(src)}</li>
        ))}
      </ul>
      <Divider className="my-2" />
      <Typography variant="subtitle1">Destinations</Typography>
      <ul>
        {details.destinations && details.destinations.map((dst, i) => (
          <li key={i}>{JSON.stringify(dst)}</li>
        ))}
      </ul>
    </Paper>
  );
}

export default OrderDetailsPanel; 