import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Skeleton,
  Card,
} from "@mui/material";

interface TableSkeletonProps {
  columns: number;
  rows?: number;
  headers?: string[];
}

const TableSkeleton: React.FC<TableSkeletonProps> = ({
  columns,
  rows = 5,
  headers,
}) => {
  return (
    <Card>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {headers
                ? headers.map((h, i) => (
                    <TableCell key={i} sx={{ fontWeight: 600 }}>
                      {h}
                    </TableCell>
                  ))
                : Array.from({ length: columns }).map((_, i) => (
                    <TableCell key={i}>
                      <Skeleton variant="text" width={80} />
                    </TableCell>
                  ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <TableRow key={rowIdx}>
                {Array.from({ length: columns }).map((_, colIdx) => (
                  <TableCell key={colIdx}>
                    <Skeleton
                      variant="text"
                      width={colIdx === 0 ? "60%" : colIdx === columns - 1 ? 60 : "40%"}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
};

export default TableSkeleton;
