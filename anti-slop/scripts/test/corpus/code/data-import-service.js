import _ from 'lodash';
import moment from 'moment';

export function formatRows(rows) {
  return _.map(rows, (row) => ({
    ...row,
    createdAt: moment(row.createdAt).format('YYYY-MM-DD'),
  }));
}
