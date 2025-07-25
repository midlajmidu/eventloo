from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    """Standard pagination with 20 items per page"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class LargePagination(PageNumberPagination):
    """Large pagination with 50 items per page for data-heavy pages"""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class SmallPagination(PageNumberPagination):
    """Small pagination with 10 items per page for detailed views"""
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 50


class CustomPagination(PageNumberPagination):
    """Custom pagination with enhanced response format"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 1000

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'current_page': self.page.number,
            'total_pages': self.page.paginator.num_pages,
            'page_size': self.get_page_size(self.request),
            'results': data
        }) 