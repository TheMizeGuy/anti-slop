"""Order lookup. Coverage boundary: the query below interpolates request values
straight into SQL, which is a real defect this scanner has no rule for."""


def find_orders(cursor, customer, status):
    query = f"SELECT * FROM orders WHERE customer = '{customer}' AND status = '{status}'"
    cursor.execute(query)
    return cursor.fetchall()


def order_detail(cursor, order_id):
    cursor.execute("SELECT * FROM orders WHERE id = " + str(order_id))
    return cursor.fetchone()
